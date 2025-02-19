import express from 'express'
import userRoutes from './routes/userRoutes.js'
import cors from 'cors'
import dotenv from 'dotenv'


dotenv.config();

// Log para verificar as variáveis de ambiente (temporário)
console.log('Email user:', process.env.EMAIL_USER)
console.log('Email pass:', process.env.EMAIL_APP_PASSWORD)

const app = express()

app.use(cors())

//Rota para teste
app.get('/', (req,res) => {
    res.send('Servidor está funcionando! 🚀')
})

app.listen(3000, () =>{
    console.log('Servidor Rodando')
})


app.use(express.json())
app.use('/api', userRoutes)