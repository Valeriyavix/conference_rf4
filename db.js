import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, "conf.db"));
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
login TEXT UNIQUE NOT NULL,
password TEXT NOT NULL,
fio TEXT NOT NULL,
phone TEXT NOT NULL,
email TEXT NOT NULL,
created_at TEXT DEFAULT (datetime('now'))
    );
`);


const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
if (count === 0) {
  const stmt = db.prepare(`
  INSERT INTO users (login, password, fio, phone, email)
            VALUES(?, ?, ?, ?, ?)
            `);
  const hash = (pwd) => bcrypt.hashSync(pwd, 10);
  stmt.run("ivan", hash('Demo77'), "Иванов Иван", "8(999)123-45-67", "ivan@mail.ru");
  stmt.run("petr", "demo", "Петров Петр", "8(999)123-45-68", "petr@mail.ru");
  stmt.run("anna", "demo", "Анновна Анна", "8(999)123-45-69", "anna@mail.ru");
   stmt.run('Conf2027', hash('Demo77'), 'Администратор', '8(885)888-45-88', 'admin@conf.ru');
  console.log("Тектовые данные добавлены");
}

db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT  NOT NULL,
    type TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
    );
`);

const countRooms = db.prepare("SELECT COUNT(*) AS c FROM rooms").get().c;
if (countRooms === 0) {
  const stmt = db.prepare(`
            INSERT INTO rooms (name, type, capacity)
            VALUES(?,?,?)`);

  stmt.run("Аудитория №1", "Аудитория", "100");
  stmt.run("Аудитория №2", "Аудитория", "50");
  stmt.run("Актовый зал", "Зал", "300");
  stmt.run("Кино зал", "Зал", "350");
  stmt.run("Кабинет", "Кабинет", "20");
  console.log("Комнаты добавлены");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  date_start TEXT NOT NULL,
  payment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Новая',
  review TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
 );
`);

const requestsCount = db.prepare("SELECT COUNT(*) AS c FROM requests").get().c;

if (requestsCount === 0) {
  const stmtRequest = db.prepare(`
            INSERT INTO requests (user_id, room_id, date_start, payment)
            VALUES(?, ?, ?, ?)
            `);

  stmtRequest.run(1, 1, "2027-03-15", "При очном посещении");
  stmtRequest.run(1, 3, "2027-03-20", "Перевод по СБП");
  stmtRequest.run(2, 3, "2027-04-01", "При очном посещении");
  console.log("Тестовые заявки добавлены");
}

class UserModel {
 constructor(){
 this.table = "users";
 }

 findById(id){
  return db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
 }

 findByLogin(login){
 return db.prepare(`SELECT * FROM ${this.table} WHERE login = ?`).get(login);
 }

 findByAll() {
  return db.prepare(`SELECT * FROM ${this.table}`).all();
 }

 count() {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${this.table}`).get().c;
  }

 exists(login) {
 const user = this.findByLogin(login);
 return user !==undefined;
   }

create({ login, password, fio, phone, email}) {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare(`
        INSERT INTO ${this.table} (login, password, fio, phone, email)
        VALUES (?,?,?,?,?)
        `).run(login, hash, fio, phone, email);
        return this.findById(r.lastInsertRowid);
}

}
class RoomModel {
constructor() {
  this.table = 'rooms';
}
findAll() {
  return db.prepare(`SELECT * FROM ${this.table}`).all();
}
findById(id) {
  return db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
}
findByType(type) {
  return db.prepare(`SELECT * FROM ${this.table} WHERE type = ?`).all(type);
}
count() {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${this.table}`).get().c;
  }
}
class RequestModel {
  constructor () {
    this.table = 'requests';
  }
  findById(id) {
    return db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`).get(id);
  }
  findByUser(userId) {
    return db
    .prepare(
      `
      SELECT r.*, rm.name AS room_name, rm.type AS room_type
      FROM ${this.table} r
      JOIN rooms rm ON rm.id = r.room_id
      WHERE r.user_id = ?
      ORDER BY r.id DESC
      `,
    )
    .all(userId);
  }
  findByDetailed() {
    return db
    .prepare(
      `
      SELECT r.*, u.fio, u.login, rm.name AS room_name, rm.type AS room_type
      FROM ${this.table} r
      JOIN users u ON u.id = r.user_id
      JOIN rooms rm ON rm.id = r.room_id
      ORDER BY r.id DESC
      `,
    )
    .all();
  }
findDetailed(id) {
  return db.prepare(`
    SELECT r.*,
    u.fio AS user_fio,
    u.login AS user_login,
    u.email AS user_email,
    u.phone AS user_phone,
   rm.name AS room_name,
   rm.type AS room_type,
   rm.capacity AS room_capacity
   FROM ${this.table} r
   JOIN users u ON u.id = r.user_id
   JOIN rooms rm ON rm.id = r.room_id
   WHERE r.id = ? 
    `).get(id);
}
 addReview(id, userId, review) {
  if (!review || !review.trim()) return false;
  const r = db.prepare(`
    UPDATE ${this.table}
    SET review = ?
    WHERE id = ? AND user_id = ? AND status = 'Завершено'
    `).run(review.trim(), id, userId);
    return r.changes >0;
 }

  count() {
    return db.prepare(`SELECT COUNT(*) AS c FROM ${this.table}`).get().c;
    }
  updateStatus(id, status) {
      return db
      .prepare(
        `
        UPDATE ${this.table} SET status = ? WHERE id = ?
        `,
      )
      .run(status, id);
  }

  create({ userId, roomId, dateStart, payment}) {
      const r = db.prepare(`
          INSERT INTO ${this.table} (user_id, room_id, date_start, payment)
      VALUES (?,?,?,?)
      `).run(userId, roomId, dateStart, payment);
      return this.findById(r.lastInsertRowid);
  }
}
export const Requests = new RequestModel();
export const Room = new RoomModel();

export const User = new UserModel();

export default db;