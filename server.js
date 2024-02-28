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
  port: process.env.DB_PORT,
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
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
  destination: function (req, file, cb) {
    cb(null, 'Cvs/');
  },
});

const upload = multer({ storage });

const enviarCorreoYGuardarDatos = async (req, res, templateCliente, template, correoCliente, correoCC) => {
  try {
    const { nombre, telefono, email, comentario, divisionEmpresarial, tema, tipo, divisionSeleccionada, ciudad, cv } = req.body;

    // Configuración de strings para diferentes formularios
    const config = {
      '/enviar-correo/plagas': {
        fromCliente: `"¡Hola" ${nombre}!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/limpieza': {
        fromCliente: `"¡Hola" ${nombre}!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/jardineria': {
        fromCliente: `"¡Hola" ${nombre}!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/desinfeccion': {
        fromCliente: `"¡Hola" ${nombre}!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/at-cliente': {
        fromCliente: `"¡Hola" ${nombre}!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/at-proveedor': {
        fromCliente: `"¡Hola" <${nombre}>!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/responsabilidad-social': {
        fromCliente: `"¡Hola" ${nombre}!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Cliente desde la Web",
      },
      '/enviar-correo/trabaja-nosotros': {
        fromCliente: `"¡Hola" ${nombre}!`,
        subjectCliente: "Gracias por contactarnos",
        subject: "Nuevo Empleado desde la Web",
      },
    };

    if (telefono.length === 10 && telefono.startsWith("09")) {
      const numeroWhatsApp = "+593" + telefono.substring(1);
      const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent("Hola, veo que estás interesado en...")}`;

      // Renderizar el contenido HTML a partir de una plantilla EJS
      const templatePath = path.join(__dirname, 'views/ecovitali', template);
      const templatePathCliente = path.join(__dirname, 'views/clientes', templateCliente);
      
      // const htmlTemplate = await ejs.renderFile(templatePath, { nombre, telefono, email, comentario, divisionEmpresarial, enlaceWhatsApp, tema, tipo, divisionSeleccionada, ciudad, cv });
      const htmlTemplate = await ejs.renderFile(templatePath, { nombre, telefono, email, comentario, divisionEmpresarial, enlaceWhatsApp, tema, tipo, divisionSeleccionada, ciudad, cv });
      const htmlTemplateCliente = await ejs.renderFile(templatePathCliente, { nombre, telefono, email, comentario, divisionEmpresarial, enlaceWhatsApp, tema, tipo, divisionSeleccionada, ciudad, cv });

      const mailOptionsClientes = {
        from: `"Ecovitali"<${config[req.url].from}>`,
        to: correoCliente,
        subject: config[req.url].subjectCliente,
        html: htmlTemplateCliente,
      };

      const mailOptions = {
        from: `"Página Web Ecovitali"<${config[req.url].from}>`,
        to: destinatario,
        cc: correoCC,
        subject: config[req.url].subject,
        html: htmlTemplate,
      }

      // Adjunta el archivo en caso de que se ejecute el endpoint trabaja con nosotros
      if (req.url === '/enviar-correo/trabaja-nosotros' && req.file) {
        mailOptions.attachments = [{ filename: req.file.originalname, path: path.join(__dirname, 'Cvs', req.file.filename), cid: 'cv' }];
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUsuario,
          pass: contraseñaUsuario,
        },
      });

      // Enviar ambos correos electrónicos simultáneamente
      await Promise.all([
        transporter.sendMail(mailOptions),
        transporter.sendMail(mailOptionsClientes)
      ]);

      let query = '';
      let values = [];

      switch (req.url) {
        case '/enviar-correo/plagas':
        case '/enviar-correo/limpieza':
        case '/enviar-correo/jardineria':
        case '/enviar-correo/desinfeccion':
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

app.post('/enviar-correo/plagas', async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'cliente-plagas.ejs', 'correo-plagas.ejs', correoCliente, cc);
});

app.post('/enviar-correo/limpieza', async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'cliente-limpieza.ejs', 'correo-limpieza.ejs', correoCliente);
});

app.post('/enviar-correo/jardineria', async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'cliente-jardineria.ejs', 'correo-jardineria.ejs', correoCliente);
});

app.post('/enviar-correo/desinfeccion', async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'cliente-desinfeccion.ejs', 'correo-desinfeccion.ejs', correoCliente);
});

app.post('/enviar-correo/at-cliente', async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'atencion-clientes.ejs', 'at-cliente.ejs', correoCliente);
});

app.post('/enviar-correo/at-proveedor', async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'proveedores.ejs', 'at-proveedores.ejs', correoCliente);
});

app.post('/enviar-correo/responsabilidad-social', async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'rse.ejs', 'responsabilidad-social.ejs', correoCliente);
});

app.post('/enviar-correo/trabaja-nosotros', upload.single('cv'), async (req, res) => {
  const correoCliente = req.body.email;
  await enviarCorreoYGuardarDatos(req, res, 'cliente-trabaja-nosotros.ejs', 'trabaja-nosotros.ejs', correoCliente);
});

app.listen(PORT, () => {
  console.log(`Backend iniciado en http://localhost:${PORT}`);
});
