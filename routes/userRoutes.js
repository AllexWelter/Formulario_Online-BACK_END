import express from 'express';
import connection from '../database.js';
import yup from 'yup';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const router = express.Router();

// Esquema de validação para o usuário
const userSchema = yup.object().shape({
    nome: yup.string().required('O nome é obrigatório'),
    email: yup.string().email('E-mail inválido').required('O e-mail é obrigatório')
});

// Configuração do nodemailer para enviar emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Função para verificar a configuração do email
const verificarConfigEmail = async () => {
    try {
        await transporter.verify();
        console.log('Configuração de email verificada com sucesso!');
        return true;
    } catch (error) {
        console.error('Erro na verificação do email:', {
            message: error.message,
            code: error.code,
            response: error.response
        });
        return false;
    }
};

// Verificar configuração ao iniciar
verificarConfigEmail();

//rota para listar users
router.get('/users', (req, res) => {
    connection.query('SELECT * FROM usuarios', (err, results) => {
        if (err) {
            console.error('Erro ao buscar usuários:', err);
            return res.status(500).json({ error: err.message })
        }
        console.log('Usuários encontrados:', results);
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
        const [quizResult] = await connection.promise().query('INSERT INTO usuario_quiz (id_usuario, data_inicio, data_termino, pontuacao) VALUES (?, NOW(), NULL, 0)', [userId]);
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
        const [quiz] = await connection.promise().query(
            'SELECT pontuacao FROM usuario_quiz WHERE id_quiz = ?', 
            [id_quiz]
        );

        if (quiz.length === 0) {
            return res.status(404).json({ error: 'Quiz não encontrado' });
        }

        if (quiz[0].pontuacao === 0) {
            const [respostas] = await connection.promise().query(
                'SELECT uqr.id_alternativa, alt.pontuacao ' +
                'FROM usuarios_quiz_respostas uqr ' +
                'JOIN alternativas alt ON uqr.id_alternativa = alt.id_alternativa ' +
                'WHERE uqr.id_quiz = ?',
                [id_quiz]
            );

            const pontuacao = respostas.reduce((total, resp) => total + (resp.pontuacao || 0), 0);

            await connection.promise().query(
                'UPDATE usuario_quiz SET pontuacao = ? WHERE id_quiz = ?',
                [pontuacao, id_quiz]
            );

            return res.json({ pontuacao });
        }

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
        const [perguntas] = await connection.promise().query('SELECT id_pergunta FROM perguntas');
        const perguntasIds = perguntas.map(p => p.id_pergunta);

        const respostasIds = respostas.map(r => r.id_pergunta);
        const todasRespondidas = perguntasIds.every(id => respostasIds.includes(id));

        if (!todasRespondidas) {
            return res.status(400).json({ error: 'Todas as perguntas devem ser respondidas' });
        }

        for (const resposta of respostas) {
            const [alternativas] = await connection.promise().query('SELECT id_alternativa FROM alternativas WHERE id_pergunta = ?', [resposta.id_pergunta]);
            const alternativasIds = alternativas.map(a => a.id_alternativa);

            if (!alternativasIds.includes(resposta.id_alternativa)) {
                return res.status(400).json({ error: 'Alternativa inválida para a pergunta' });
            }
        }

        for (const resposta of respostas) {
            await connection.promise().query('INSERT INTO usuarios_quiz_respostas (id_quiz, id_alternativa) VALUES (?, ?)', [id_quiz, resposta.id_alternativa]);
        }

        const [pontuacaoResult] = await connection.promise().query(`
            SELECT SUM(a.pontuacao) as pontuacao
            FROM usuarios_quiz_respostas uqr
            JOIN alternativas a ON uqr.id_alternativa = a.id_alternativa
            WHERE uqr.id_quiz = ?
        `, [id_quiz]);

        const pontuacao = pontuacaoResult[0].pontuacao || 0;

        await connection.promise().query('UPDATE usuario_quiz SET data_termino = NOW(), pontuacao = ? WHERE id_quiz = ?', [pontuacao, id_quiz]);

        res.json({ pontuacao });
    } catch (err) {
        console.error('Erro ao enviar respostas:', err);
        res.status(500).json({ error: 'Erro ao enviar respostas' });
    }
});

// Endpoint para enviar email com o resultado do quiz
router.get('/email/:idQuiz', async (req, res) => {
    const { idQuiz } = req.params;

    try {
        // Verificar se o transporter está configurado
        if (!await verificarConfigEmail()) {
            throw new Error('Configuração de email não está funcionando');
        }

        // Buscar informações do quiz e usuário
        const [quizResults] = await connection.promise().query(`
            SELECT 
                uq.id_quiz,
                uq.pontuacao,
                uq.data_inicio,
                uq.data_termino,
                u.nome,
                u.email,
                (SELECT COUNT(*) FROM usuarios_quiz_respostas WHERE id_quiz = uq.id_quiz) as total_respostas,
                (SELECT COUNT(*) FROM perguntas) as total_perguntas
            FROM usuario_quiz uq
            JOIN usuarios u ON u.id_usuario = uq.id_usuario
            WHERE uq.id_quiz = ?
        `, [idQuiz]);

        if (quizResults.length === 0) {
            return res.status(404).json({ error: 'Quiz não encontrado' });
        }

        const quizInfo = quizResults[0];
        const percentualAcerto = ((quizInfo.pontuacao / quizInfo.total_perguntas) * 100).toFixed(1);

        // Template do email
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50; text-align: center;">Resultado do Quiz</h2>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="color: #2c3e50;">Olá ${quizInfo.nome}!</h3>
                    
                    <div style="background-color: white; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <h4 style="color: #007bff; margin: 0;">Resumo do seu desempenho:</h4>
                        <ul style="list-style: none; padding: 0;">
                            <li style="margin: 10px 0;">📊 Pontuação final: <strong>${quizInfo.pontuacao} pontos</strong></li>
                            <li style="margin: 10px 0;">✨ Percentual de acerto: <strong>${percentualAcerto}%</strong></li>
                            <li style="margin: 10px 0;">❓ Questões respondidas: <strong>${quizInfo.total_respostas}/${quizInfo.total_perguntas}</strong></li>
                        </ul>
                    </div>
                </div>
                
                <p style="color: #666; text-align: center;">
                    Obrigado por participar do nosso quiz! Esperamos que tenha se divertido e aprendido algo novo.
                </p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="color: #666;">Atenciosamente,<br>Equipe do Quiz</p>
                </div>
            </div>
        `;

        // Configuração do email
        const mailOptions = {
            from: {
                name: 'Quiz App',
                address: process.env.EMAIL_USER
            },
            to: quizInfo.email,
            subject: `Resultado do seu Quiz: ${percentualAcerto}% de acerto! 🎯`,
            html: emailHtml
        };

        // Enviar email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email enviado com sucesso:', info.messageId);

        // Atualizar status no banco
        await connection.promise().query(
            'UPDATE usuario_quiz SET email_enviado = TRUE WHERE id_quiz = ?',
            [idQuiz]
        );

        res.json({ 
            success: true,
            message: 'Email enviado com sucesso',
            messageId: info.messageId
        });

    } catch (err) {
        console.error('Erro ao enviar email:', {
            message: err.message,
            code: err.code,
            command: err.command,
            response: err.response
        });
        
        res.status(500).json({ 
            success: false,
            error: 'Erro ao enviar email',
            details: err.message
        });
    }
});

export default router;