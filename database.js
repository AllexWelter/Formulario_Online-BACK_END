import mysql from 'mysql2'


const connection = mysql.createConnection({
    host:'localhost',
    port: 3306,
    user:'root',
    password:'allex123',
    database:'Projeto_Final_Harve_Form'
})

connection.connect((err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err)
        return
    }
    console.log('Conectado ao banco de dados MysQL')
})

export default connection

