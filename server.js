import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import db, {User, Room, Requests} from "./db.js";
import bcrypt from 'bcryptjs';
import session from 'express-session';


const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));



/*
app.route("/create").get(requireAuth, (req, res) => {
  const rooms = Room.findAll();
  res.render("create_request", { rooms, errors: [] });
})
.post(requireAuth, (req, res) => {
  const { room_id, date_start, payment } = req.body;
  if (!room_id || !date_start || !payment) {
    const rooms = Room.findAll();
    return res.render("create_request");
  }
  Requests.create({
    userId: req.session.userId,
    room_id: room_id,
    dateStart: date_start,
    payment: payment,
  });
  res.redirect("/dashboard");
});
*/

app.use(
  session({
    secret: "conference2027",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    const now = Date.now();
    const INACTIVITY_LIMIT = 20 * 60 * 1000;
    if (
      req.session.lastActivity &&
      now - req.session.lastActivity > INACTIVITY_LIMIT
    ){
      return req.session.destroy(() => {
        res.redirect("/login");
      });
    }
    req.session.lastActivity = now;
  }
  next();
});
const requireAuth = (req, res, next) =>
  req.session.userId ? next() : res.redirect('/login');

const requireAdmin = (req, res, next) => 
  req.session.login === 'Conf2027' ? next() : res.redirect('/login');


app.get('/login', (req, res) => {
  const flash = req.session.flash || null;
  delete req.session.flash;

  res.render('auth', {
    mode: 'login',
    error: null,
    flash
  });
});


app.post("/login", (req, res) => {
  const user = User.findByLogin(req.body.login);

  if (user && bcrypt.compareSync(req.body.password, user.password)) {
    req.session.userId = user.id;
    req.session.fio = user.fio;
    req.session.login = user.login;
    req.session.lastActivity = Date.now();

    return res.redirect(user.login === "Conf2027" ? "/admin" : "/dashboard");
  }
  res.render("auth", {
    mode: "login",
    error: "Неверный логин или пароль",
    flash: null,
  });
});
// app.all('/login', (req, res) => {
//   req.session.destroy(() => res.redirect('/login'));
// });



const RULES = [
  { field: 'login',    test: v => /^[A-Za-z0-9]{6,}$/.test(v),             msg: 'Логин: латиница+цифры, минимум 6 символов' },
  { field: 'password', test: v => v && v.length >= 8,                      msg: 'Пароль: минимум 8 символов' },
  { field: 'fio',      test: v => /^[А-Яа-яЁё\s]+$/.test(v),               msg: 'ФИО: только кириллица и пробелы' },
  { field: 'phone',    test: v => /^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/.test(v), msg: 'Телефон: формат 8(ХХХ)ХХХ-ХХ-ХХ' },
  { field: 'email',    test: v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),    msg: 'Email: некорректный формат' }
];

const validate = data => RULES
  .filter(({ field, test }) => !test((data[field] || '').trim()))
  .map(r => r.msg);

app.get('/register', (req, res) => {
  res.render('auth', {
    mode: 'register',
    form: {},
    errors: []
  });
});

app.post('/register', (req, res) => {
  const errors = validate(req.body);
  if (User.exists(req.body.login)) {
    errors.push('Логин уже занят');
  }
  if (errors.length) {
    return res.render('auth', {
      mode:'register',
      form: req.body,
      errors
    });
  }
  User.create(req.body);
  req.session.flash = {
    type: 'success',
    text: 'Регистрация успешна. Войдите.'
  };
  res.redirect('/login');
});

app.get("/", (req, res) => {
   res.redirect("rooms");
});

app.get("/rooms", (req, res) => {
    const rooms = Room.findAll();
    res.render("rooms", { rooms });
});

app.get("/rooms/type/:type", (req, res) => {
    const rooms = Room.findByType(req.params.type);
    res.render("rooms", { rooms });
});



app.get("/dashboard", requireAuth, (req, res) => {
  const requests = Requests.findByUser(req.session.userId);
  res.render("requests_list", { isAdmin: false, requests });
});

app.get("/admin", requireAdmin, (req, res) => {
  const requests = Requests.findByDetailed();
  res.render("requests_list", { isAdmin: true, requests });
});

app.post("/admin", requireAdmin, (req, res) => {
  Requests.updateStatus(req.body.id, req.body.status);
  res.redirect("/admin");
});

app.get("/request/:id", requireAuth, (req, res) => {
  const request = Requests.findDetailed(req.params.id);

  if (!request) {
    return res.status(404).send("Заявка не найдена");
  }

  const isOwner = request.user_id === req.session.userId;
  const isAdmin = req.session.login === "Conf2027";

  if (!isOwner && !isAdmin) {
    return res.status(403).send("Доступ запрещён");
  }

  res.render("request_detail", { request, isOwner, isAdmin });
});

app.post("/review/:id", requireAuth, (req, res) => {
  const request = Requests.findDetailed(req.params.id);

  if (!request) {
    return res.status(404).send("Заявка не найдена");
  }

  if (request.user_id !== req.session.userId) {
    return res.status(403).send("Только владелец может оставить отзыв");
  }

  const review = (req.body.review || "").trim();
  Requests.addReview(request.id, req.session.userId, review);

  res.redirect(`/request/${request.id}`);
});

app.route("/create")
    .get(requireAuth, (req, res) => {
        const rooms = Room.findAll();
        res.render("create_request", { rooms, errors: [] });
    })
    .post(requireAuth, (req, res) => {
        const { room_id, date_start, payment } = req.body;
        if (!room_id || !date_start || !payment) {
            const rooms = Room.findAll();
            return res.render("create_request", {
                rooms,
                errors: ["Заполните все поля"],
            });
        }
        Requests.create({
            userId: req.session.userId,
            roomId: room_id,
            dateStart: date_start,
            payment: payment,
        });
        res.redirect("/dashboard");
    });

app.get(`/about`, (req, res) => {
   res.render("about");
});


const user = User.count();
const room = Room.count();
const requests = Requests.count();
// const newRequest = Requests.create({
//     userId: 1,
//     roomId: 2,
//     dateStart: "2027-04-10",
//     payment: "При очном посещении",
//  });

//  const newUser = User.create({
//     login: 'test_user',
//     password: 'test12345',
//     fio: 'Тестов Тест',
//     phone: '8(999)111-22-33',
//     email: 'test@example.com'
//  });
 

//  console.log("Созданная заявка:", newRequest);
// console.log(user, room, requests);
 

app.listen(PORT, () => {
  console.log(`Сервер: http://localhost:${PORT}`);
});