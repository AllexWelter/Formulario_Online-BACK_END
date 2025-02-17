import express from 'express'
import connection from '../database.js'
import yup from 'yup'
const router = express.Router()
import nodemailer from 'nodemailer'

// Esquema de validação para o usuário
const userSchema = yup.object().shape({
    nome: yup.string().required('O nome é obrigatório'),
    email: yup.string().email('E-mail inválido').required('O e-mail é obrigatório')
});


//rota para listar users
router.get('/users', (req, res) => {
    connection.query('SELECT * FROM usuarios', (err, results) => {
        if (err) {
            console.error('Erro ao buscar usuários:', err); // Log para depuração
            return res.status(500).json({ error: err.message })
        }
        console.log('Usuários encontrados:', results); // Log para depuração
        res.json(results)
    })
})

// Endpoint para iniciar o quiz
router.post('/iniciar', async (req, res) => {
    const { nome, email } = req.body;

    try {
        // Valida os dados de entrada
        await userSchema.validate(req.body, { abortEarly: false });

        // Verificar se o usuário existe
        const [user] = await connection.promise().query('SELECT id_usuario FROM usuarios WHERE email = ?', [email]);

        let userId;
        if (user.length === 0) {
            // Se o usuário não existir, criar um novo
            const [result] = await connection.promise().query('INSERT INTO usuarios (nome, email) VALUES (?, ?)', [nome, email]);
            userId = result.insertId;
        } else {
            userId = user[0].id_usuario;
        }

        // Criar registro na tabela usuario_quiz
        const [quizResult] = await connection.promise().query('INSERT INTO usuario_quiz (id_usuario, data_inicio, data_termino, pontuacao) VALUES (?, NOW(),NULL, 0)', [userId]);
        const quizId = quizResult.insertId;

        res.status(201).json({ id_quiz: quizId });
    } catch (err) {
        console.error('Erro ao iniciar quiz:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ errors: err.errors });
        }
        res.status(500).json({ error: 'Erro ao iniciar quiz' });
    }
});

// Endpoint para buscar uma pergunta e suas alternativas
router.get('/perguntas/:numero', async (req, res) => {
    const { numero } = req.params;

    try {
        // Pesquisar pergunta por id
        const [pergunta] = await connection.promise().query('SELECT * FROM perguntas WHERE id_pergunta = ?', [numero]);

        if (pergunta.length === 0) {
            return res.status(404).json({ error: 'Pergunta não encontrada' });
        }

        // Vincular as alternativas
        const [alternativas] = await connection.promise().query('SELECT * FROM alternativas WHERE id_pergunta = ?', [numero]);

        // Contar o número total de perguntas
        const [totalPerguntas] = await connection.promise().query('SELECT COUNT(*) as total FROM perguntas');

        res.json({
            pergunta: pergunta[0],
            alternativas,
            totalPerguntas: totalPerguntas[0].total
        });
    } catch (err) {
        console.error('Erro ao buscar pergunta:', err);
        res.status(500).json({ error: 'Erro ao buscar pergunta' });
    }
});

// Endpoint para buscar o resultado do quiz
router.get('/quiz/resultado/:id_quiz', async (req, res) => {
    const { id_quiz } = req.params;

    try {
        // Primeiro, verifica se o quiz existe
        const [quiz] = await connection.promise().query(
            'SELECT pontuacao FROM usuario_quiz WHERE id_quiz = ?', 
            [id_quiz]
        );

        if (quiz.length === 0) {
            return res.status(404).json({ error: 'Quiz não encontrado' });
        }

        // Se o quiz ainda não foi finalizado (pontuação = 0), calcula a pontuação
        if (quiz[0].pontuacao === 0) {
            // Busca todas as respostas do usuário
            const [respostas] = await connection.promise().query(
                'SELECT uqr.id_alternativa, alt.pontuacao ' +
                'FROM usuarios_quiz_respostas uqr ' +
                'JOIN alternativas alt ON uqr.id_alternativa = alt.id_alternativa ' +
                'WHERE uqr.id_quiz = ?',
                [id_quiz]
            );

            // Calcula a pontuação total
            const pontuacao = respostas.reduce((total, resp) => total + (resp.pontuacao || 0), 0);

            // Atualiza a pontuação no quiz
            await connection.promise().query(
                'UPDATE usuario_quiz SET pontuacao = ? WHERE id_quiz = ?',
                [pontuacao, id_quiz]
            );

            return res.json({ pontuacao });
        }

        // Se já tem pontuação, retorna ela
        res.json({ pontuacao: quiz[0].pontuacao });
    } catch (err) {
        console.error('Erro ao calcular pontuação:', err);
        res.status(500).json({ error: 'Erro ao calcular pontuação', details: err.message });
    }
});

// Endpoint para enviar respostas do quiz
router.post('/enviar', async (req, res) => {
    const { id_quiz, respostas } = req.body;

    try {
        // Verificar se todas as perguntas foram respondidas
        const [perguntas] = await connection.promise().query('SELECT id_pergunta FROM perguntas');
        const perguntasIds = perguntas.map(p => p.id_pergunta);

        const respostasIds = respostas.map(r => r.id_pergunta);
        const todasRespondidas = perguntasIds.every(id => respostasIds.includes(id));

        if (!todasRespondidas) {
            return res.status(400).json({ error: 'Todas as perguntas devem ser respondidas' });
        }

        // Verificar se apenas uma alternativa foi selecionada por pergunta
        for (const resposta of respostas) {
            const [alternativas] = await connection.promise().query('SELECT id_alternativa FROM alternativas WHERE id_pergunta = ?', [resposta.id_pergunta]);
            const alternativasIds = alternativas.map(a => a.id_alternativa);

            if (!alternativasIds.includes(resposta.id_alternativa)) {
                return res.status(400).json({ error: 'Alternativa inválida para a pergunta' });
            }
        }

        // Salvar na tabela usuario_quiz_respostas
        for (const resposta of respostas) {
            await connection.promise().query('INSERT INTO usuarios_quiz_respostas (id_quiz, id_alternativa) VALUES (?, ?)', [id_quiz, resposta.id_alternativa]);
        }

        // Calcular o resultado final
        const [pontuacaoResult] = await connection.promise().query(`
            SELECT SUM(a.pontuacao) as pontuacao
            FROM usuarios_quiz_respostas uqr
            JOIN alternativas a ON uqr.id_alternativa = a.id_alternativa
            WHERE uqr.id_quiz = ?
        `, [id_quiz]);

        const pontuacao = pontuacaoResult[0].pontuacao || 0;

        // Atualizar a tabela usuario_quiz com a data de término e pontuação
        await connection.promise().query('UPDATE usuario_quiz SET data_termino = NOW(), pontuacao = ? WHERE id_quiz = ?', [pontuacao, id_quiz]);

        res.json({ pontuacao });
    } catch (err) {
        console.error('Erro ao enviar respostas:', err);
        res.status(500).json({ error: 'Erro ao enviar respostas' });
    }
});

// Configuração do nodemailer para enviar emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'allexwelter13@gmail.com', // Substitua pelo seu email
        pass: 'obviamente a senha não está inserida corretamente aqui' // Substitua pela sua senha
    }
});

// Endpoint para enviar email com o resultado do quiz
router.get('/email/:idQuiz', async (req, res) => {
    const { idQuiz } = req.params;

    try {
        // Verificar se o quiz existe
        const [quiz] = await connection.promise().query('SELECT * FROM usuario_quiz WHERE id_quiz = ?', [idQuiz]);

        if (quiz.length === 0) {
            return res.status(404).json({ error: 'Quiz não encontrado' });
        }

        const [usuario] = await connection.promise().query('SELECT * FROM usuarios WHERE id_usuario = ?', [quiz[0].id_usuario]);

        // Enviar email
        const mailOptions = {
            from: 'allexwelter13@gmail.com', // Substitua pelo seu email
            to: usuario[0].email,
            subject: 'Resultado do Quiz',
            text: `Olá ${usuario[0].nome}, sua pontuação no quiz foi ${quiz[0].pontuacao}.`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro ao enviar email:', error);
                return res.status(500).json({ error: 'Erro ao enviar email' });
            }
            res.json({ message: 'Email enviado com sucesso' });
        });
    } catch (err) {
        console.error('Erro ao enviar email:', err);
        res.status(500).json({ error: 'Erro ao enviar email' });
    }
});

export default router