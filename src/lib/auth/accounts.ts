import "server-only";
import { compare } from "bcryptjs";
import { z } from "zod";
import accountsFile from "../../../data/accounts.json";
import type { SessionUser } from "@/lib/types";

const accountSchema = z.object({
  username: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(100),
  passwordHash: z
    .string()
    .regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, "Hash bcrypt không hợp lệ."),
  role: z.enum(["admin", "user"]).default("user"),
  active: z.boolean().default(true),
});

const accountsFileSchema = z.object({
  users: z.array(accountSchema),
});

type Account = z.infer<typeof accountSchema>;

// Hash giả dùng để giữ thời gian phản hồi tương đối đồng đều khi username
// không tồn tại, hạn chế dò tài khoản qua timing.
const DUMMY_HASH =
  "$2b$12$68erlAQ8.rbDZeJm7Zk04ujdPWN9v.Hj/EX3RhOf0sTuAFZv.GqAm";

export class AccountsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountsConfigError";
  }
}

let cachedAccounts: Account[] | null = null;

function loadAccounts(): Account[] {
  if (cachedAccounts) return cachedAccounts;

  let source: unknown = accountsFile;
  const envJson = process.env.AUTH_USERS_JSON?.trim();

  if (envJson) {
    try {
      source = JSON.parse(envJson);
    } catch {
      throw new AccountsConfigError(
        "Biến môi trường AUTH_USERS_JSON không phải JSON hợp lệ.",
      );
    }
  }

  const parsed = accountsFileSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    console.error(`[auth] Cấu hình tài khoản không hợp lệ: ${details}`);
    throw new AccountsConfigError(
      "Cấu hình tài khoản không hợp lệ. Kiểm tra data/accounts.json hoặc AUTH_USERS_JSON.",
    );
  }

  cachedAccounts = parsed.data.users.map((account) => ({
    ...account,
    username: account.username.toLowerCase(),
  }));

  return cachedAccounts;
}

export async function verifyCredentials(
  usernameInput: string,
  password: string,
): Promise<SessionUser | null> {
  const accounts = loadAccounts();
  const username = usernameInput.trim().toLowerCase();
  const account = accounts.find(
    (candidate) => candidate.username === username && candidate.active,
  );

  // Luôn chạy bcrypt.compare, kể cả khi không tìm thấy tài khoản.
  let passwordMatches = false;
  try {
    passwordMatches = await compare(password, account?.passwordHash ?? DUMMY_HASH);
  } catch {
    passwordMatches = false;
  }

  if (!account || !passwordMatches) return null;

  return {
    username: account.username,
    name: account.name,
    role: account.role,
  };
}
