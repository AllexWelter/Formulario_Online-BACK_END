import express from 'express'
import connection from '../database.js'
import yup from 'yup'
const router = express.Router()

// Esquema de validação para o usuário
const userSchema = yup.object().shape({
    nome: yup.string().required('O nome é obrigatório'),
    email: yup.string().email('E-mail inválido').required('O e-mail é obrigatório')
  });


//rota para listar users
router.get('/users', (req,res) => {
    connection.query('SELECT * FROM usuarios', (err, results) => {
        if (err) {
            console.error('Erro ao buscar usuários:', err); // Log para depuração
            return res.status(500).json({error: err,message})
        }
        console.log('Usuários encontrados:', results); // Log para depuração
        res.json(results)
    })
})

// Rota para criar um novo usuário
router.post('/users', async (req, res) => {
    try {
      // Valida os dados de entrada
      const validatedData = await userSchema.validate(req.body, { abortEarly: false });
  
      // Inserir no banco de dados
      const { nome, email } = validatedData;
      connection.query('INSERT INTO usuarios (nome, email) VALUES (?, ?)', [nome, email], (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: results.insertId, nome, email });
      });
    } catch (err) {
      // Captura erros de validação
      res.status(400).json({ errors: err.errors });
    }
  });
  

export default router