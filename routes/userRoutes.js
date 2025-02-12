import express from 'express'
import connection from '../database.js'

const router = express.Router()

//rota pra criar novo user
router.post('/users', (req,res) => {
    const { nome, email} = req.body

    //validação manual sem yup
    if(!nome || nome.trim() === '') {
        return res.status(400).json({error: 'O nome é obrigatório'})
    }

    if(!email || !email.includes('@')) {
        return res.status(400).json({error: 'E-mail inválido'})
    }

    //inserindo no banco
    connection.query('INSERT INTO usuarios (nome, email) VALUES (?, ?)', [nome, email], (err, results) => {
        if(err) {
            return res.status(500).json({error: err.message})
        }
        res.status(201).json({id: results.insertId, nome, email})
    })
})


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

export default router