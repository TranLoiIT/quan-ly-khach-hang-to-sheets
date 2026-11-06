#!/usr/bin/env node
/**
 * Quản lý tài khoản trong data/accounts.json.
 *
 * Cách dùng:
 *   npm run users -- list
 *   npm run users -- add <username> <password> [tên hiển thị] [admin|user]
 *   npm run users -- passwd <username> <password>
 *   npm run users -- remove <username>
 *   npm run users -- disable <username>
 *   npm run users -- enable <username>
 *
 * Mật khẩu được hash bằng bcrypt (cost 12), không bao giờ lưu plaintext.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const accountsPath = join(rootDir, "data", "accounts.json");
const BCRYPT_COST = 12;
const USERNAME_RE = /^[a-zA-Z0-9._-]{3,64}$/;
const MIN_PASSWORD_LENGTH = 10;

function usage() {
  console.log(`
Quản lý tài khoản SheetDesk (data/accounts.json)

  npm run users -- list
  npm run users -- add <username> <password> [tên hiển thị] [admin|user]
  npm run users -- passwd <username> <password>
  npm run users -- remove <username>
  npm run users -- disable <username>
  npm run users -- enable <username>

Lưu ý:
  - Username: 3-64 ký tự, chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang.
  - Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự. Nên dùng từ 16 ký tự trở lên.
  - Đặt mật khẩu trong dấu nháy kép nếu có ký tự đặc biệt của shell.
  - Nếu đang dùng biến môi trường AUTH_USERS_JSON, biến đó sẽ ghi đè file này.
`);
}

function normalizeUsername(value) {
  const username = String(value ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new Error(
      "Username không hợp lệ. Dùng 3-64 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.",
    );
  }
  return username;
}

function assertPassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
  if (password.length > 128) {
    throw new Error("Mật khẩu không được dài quá 128 ký tự.");
  }
}

async function readAccounts() {
  let raw;
  try {
    raw = await readFile(accountsPath, "utf8");
  } catch {
    throw new Error(`Không đọc được ${accountsPath}. Hãy chắc chắn file tồn tại.`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("data/accounts.json không phải JSON hợp lệ.");
  }

  if (!data || !Array.isArray(data.users)) {
    throw new Error('data/accounts.json phải có dạng { "users": [...] }.');
  }

  return data;
}

async function saveAccounts(data) {
  await writeFile(accountsPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function findUser(data, username) {
  return data.users.find((user) => String(user.username).toLowerCase() === username);
}

function printUser(user) {
  const status = user.active === false ? "disabled" : "active";
  console.log(
    `- ${user.username} | ${user.name ?? "(chưa có tên)"} | ${user.role ?? "user"} | ${status}`,
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }

  const data = await readAccounts();

  switch (command) {
    case "list": {
      if (data.users.length === 0) {
        console.log("Chưa có tài khoản nào.");
        return;
      }
      console.log(`Tài khoản trong ${accountsPath}:`);
      data.users.forEach(printUser);
      return;
    }

    case "add": {
      const username = normalizeUsername(args[0]);
      const password = args[1];
      assertPassword(password);

      if (findUser(data, username)) {
        throw new Error(`Tài khoản "${username}" đã tồn tại. Dùng "passwd" để đổi mật khẩu.`);
      }

      const name = String(args[2] ?? username).trim().slice(0, 100) || username;
      const role = args[3] === "user" ? "user" : "admin";
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

      data.users.push({ username, name, passwordHash, role, active: true });
      await saveAccounts(data);
      console.log(`Đã thêm tài khoản "${username}" (${role}).`);
      return;
    }

    case "passwd": {
      const username = normalizeUsername(args[0]);
      const password = args[1];
      assertPassword(password);

      const user = findUser(data, username);
      if (!user) {
        throw new Error(`Không tìm thấy tài khoản "${username}".`);
      }

      user.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      await saveAccounts(data);
      console.log(`Đã đổi mật khẩu cho "${username}".`);
      return;
    }

    case "remove": {
      const username = normalizeUsername(args[0]);
      const before = data.users.length;
      data.users = data.users.filter(
        (user) => String(user.username).toLowerCase() !== username,
      );
      if (data.users.length === before) {
        throw new Error(`Không tìm thấy tài khoản "${username}".`);
      }
      await saveAccounts(data);
      console.log(`Đã xoá tài khoản "${username}".`);
      return;
    }

    case "disable":
    case "enable": {
      const username = normalizeUsername(args[0]);
      const user = findUser(data, username);
      if (!user) {
        throw new Error(`Không tìm thấy tài khoản "${username}".`);
      }
      user.active = command === "enable";
      await saveAccounts(data);
      console.log(`Đã ${command === "enable" ? "kích hoạt" : "vô hiệu hoá"} "${username}".`);
      return;
    }

    default:
      usage();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\nLỗi: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
