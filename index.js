import express from 'express'
import userRoutes from './routes/userRoutes.js'

const app = express()

//Rota para teste
app.get('/', (req,res) => {
    res.send('Servidor está funcionando! 🚀')
})

app.listen(3000, () =>{
    console.log('Servidor Rodando')
})


app.use(express.json())
app.use('/api', userRoutes)