require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const path = require('path');
const mysql = require('mysql2');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  database: process.env.DB,
  port:  process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

connection.connect((err) => {
  if (err) {
    console.log("Error al conectar a la base de datos 🚨", err);
  } else {
    console.log("Conexión exitosa 🚀");
  }
});

const emailUsuario = process.env.EMAIL_USER_1;
const contraseñaUsuario = process.env.EMAIL_PASS_1;
const destinatario = process.env.DESTINATARIO_EMAIL;
const cc = process.env.CORREOCC;

const storage = multer.diskStorage({
  filename: function (res, file, cb) {
    cb(null, file.originalname);
  },
  destination: function (req, file, cb) {
    cb(null, 'Cvs/');
  },
});

const upload = multer({ storage });

const enviarCorreoYGuardarDatos = async (req, res, template, correoCC) => {
  try {
    const { nombre, telefono, email, comentario, divisionEmpresarial, tema, tipo, divisionSeleccionada, ciudad, cv } = req.body;

    // Modificación de strings para cada endpoint
    const config = {
      '/enviar-correo/divisiones-empresariales': {
        from: `"Nuevo Cliente" <${email}>`,
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/at-cliente': {
        from: `"Nuevo Cliente" <${email}>`,
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/at-proveedor': {
        from: `"Nuevo Cliente" <${email}>`,
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/responsabilidad-social': {
        from: `"Nuevo Cliente" <${email}>`,
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/trabaja-nosotros': {
        from: `"Nuevo Empleado" <${email}>`,
        subject: "Nuevo Empleado desde la Web",
      },
    };

    // Valida y suprime el número de celular para redirección
    if (telefono.length === 10 && telefono.startsWith("09")) {
      const numeroWhatsApp = "+593" + telefono.substring(1);
      const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent("Hola, veo que estás interesado en...")}`;

      const templatePath = path.join(__dirname, 'views', template);
      const htmlTemplate = await ejs.renderFile(templatePath, { nombre, telefono, email, comentario, divisionEmpresarial, enlaceWhatsApp, tema, tipo, divisionSeleccionada, ciudad, cv });

      // Pasa valores de config para cada endpoint
      const mailOptions = {
        from: config[req.url].from,
        to: destinatario,
        cc: correoCC,
        subject: config[req.url].subject,
        html: htmlTemplate,
      };

      // Adjunta el archivo solo si es el endpoint '/enviar-correo/trabaja-nosotros'
      if (req.url === '/enviar-correo/trabaja-nosotros' && req.file) {
        mailOptions.attachments = [
          {
            filename: req.file.originalname,
            path: path.join(__dirname, 'Cvs', req.file.filename),
            cid: 'cv',
          },
        ];
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUsuario,
          pass: contraseñaUsuario,
        },
      });

      const info = await transporter.sendMail(mailOptions);

      let query = '';
      let values = [];

      switch (req.url) {
        case '/enviar-correo/divisiones-empresariales':
          query = 'INSERT INTO formulario_divisiones_empresariales (nombre, telefono, email, comentario, correo_destino, division_empresarial) VALUES (?, ?, ?, ?, ?, ?)';
          values = [nombre, telefono, email, comentario, destinatario, divisionEmpresarial];
          break;

        case '/enviar-correo/at-cliente':
          query = 'INSERT INTO formulario_atencion_clientes (nombre, tema_a_consultar, correo, telefono, comentario) VALUES (?, ?, ?, ?, ?)';
          values = [nombre, tema, email, telefono, comentario];
          break;

        case '/enviar-correo/at-proveedor':
          query = 'INSERT INTO formulario_atencion_proveedores (nombre, tipo_categoria, correo, telefono, comentario) VALUES (?, ?, ?, ?, ?)';
          values = [nombre, tipo, email, telefono, comentario];
          break;

        case '/enviar-correo/responsabilidad-social':
          query = 'INSERT INTO formulario_responsabilidad_social (nombre, telefono, correo, comentario) VALUES (?, ?, ?, ?)';
          values = [nombre, telefono, email, comentario];
          break;

        case '/enviar-correo/trabaja-nosotros':
          query = 'INSERT INTO formulario_trabaja_nosotros (nombre, ciudad, telefono, correo, comentario, divisionSeleccionada, cv) VALUES (?, ?, ?, ?, ?, ?, ?)';
          values = [nombre, ciudad, telefono, email, comentario, divisionSeleccionada, cv];
          break;

        default:
          break;
      }

      connection.query(query, values, (err, results) => {
        if (err) {
          console.error('Error al insertar datos en MySQL:', err);
          res.status(500).json({ mensaje: 'Error al almacenar los datos en la base de datos' });
        } else {
          console.log('Datos almacenados en MySQL con éxito:', results);
          res.status(200).json({ mensaje: 'Correo enviado y datos almacenados con éxito' });
        }
      });

    } else {
      console.log("Número de teléfono no válido");
      res.status(400).json({ mensaje: 'Número de teléfono no válido' });
    }
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    res.status(500).json({ mensaje: "Error al enviar el correo" });
  }
};

app.post('/enviar-correo/divisiones-empresariales', async (req, res) => {
  await enviarCorreoYGuardarDatos(req, res, 'correo-divisiones.ejs');
});

app.post('/enviar-correo/at-cliente', async (req, res) => {
  await enviarCorreoYGuardarDatos(req, res, 'at-cliente.ejs');
});

app.post('/enviar-correo/at-proveedor', async (req, res) => {
  await enviarCorreoYGuardarDatos(req, res, 'at-proveedores.ejs');
});

app.post('/enviar-correo/responsabilidad-social', async (req, res) => {
  await enviarCorreoYGuardarDatos(req, res, 'responsabilidad-social.ejs');
});

app.post('/enviar-correo/trabaja-nosotros', upload.single('cv'), async (req, res) => {
  const correoCC = cc;
  await enviarCorreoYGuardarDatos(req, res, 'trabaja-nosotros.ejs', correoCC);
});

app.listen(PORT, () => {
  console.log(`Backend iniciado en http://localhost:${PORT}`);
});
