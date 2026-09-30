
// ===================== VALIDAÇÃO DE EMAIL =====================//
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// -------------------------------------------------------------------------------------

// ==================== VALIDAÇÃO DE TELEFONE =====================//
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE TAMANHO MÍNIMO/MÁXIMO =====//
export function hasMinLength(value: string, min: number): boolean {  return value.trim().length >= min;
}


export function hasMaxLength(value: string, max: number): boolean {
  return value.trim().length <= max;
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE CPF =====//
function calcCPFCheckDigit(base: string): number {
  let sum = 0;
  let weight = base.length + 1;

  for (const digit of base) {
    sum += Number(digit) * weight;
    weight--;
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const base = digits.slice(0, 9);
  const digit1 = calcCPFCheckDigit(base);
  const digit2 = calcCPFCheckDigit(base + digit1);

  return digits === `${base}${digit1}${digit2}`;
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE CNPJ =====//
function calcCNPJCheckDigit(base: string): number {
  const weights =
    base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += Number(base[i]) * weights[i];
  }

  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const base = digits.slice(0, 12);
  const digit1 = calcCNPJCheckDigit(base);
  const digit2 = calcCNPJCheckDigit(base + digit1);

  return digits === `${base}${digit1}${digit2}`;
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE CARTÃO DE CRÉDITO (LUHN) + BANDEIRA =====//
export function isValidCreditCard(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export type CreditCardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "diners"
  | "discover"
  | "elo"
  | "unknown";

export const CREDIT_CARD_BRAND_LABELS: Record<CreditCardBrand, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  diners: "Diners Club",
  discover: "Discover",
  elo: "Elo",
  unknown: "Desconhecida",
};

export function getCreditCardBrand(cardNumber: string): CreditCardBrand {
  const digits = cardNumber.replace(/\D/g, "");

  if (/^4/.test(digits)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^3(0[0-5]|[68])/.test(digits)) return "diners";
  if (/^6(011|5)/.test(digits)) return "discover";
  if (
    /^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(
      digits,
    )
  )
    return "elo";

  return "unknown";
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE DATA (DD/MM/AAAA) =====//
export function isValidDate(value: string): boolean {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (month < 1 || month > 12) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE HORA (HH:MM) =====//
export function isValidTime(value: string): boolean {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE FORÇA DE SENHA =====//
export type PasswordStrength = "fraca" | "média" | "forte" | "muito forte";

export const PASSWORD_STRENGTH_COLORS: Record<PasswordStrength, string> = {
  fraca: "bg-red-500",
  média: "bg-yellow-500",
  forte: "bg-blue-500",
  "muito forte": "bg-green-500",
};

export function getPasswordStrengthScore(password: string): number {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  return score;
}

export function getPasswordStrength(password: string): PasswordStrength {
  const score = getPasswordStrengthScore(password);

  if (score <= 1) return "fraca";
  if (score <= 2) return "média";
  if (score <= 3) return "forte";
  return "muito forte";
}

export const PASSWORD_MIN_LENGTH = 8;

export function isValidPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// -------------------------------------------------------------------------------------

// ===== VALIDAÇÃO DE CHAVE PIX =====//
export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

const RANDOM_PIX_KEY_LENGTH = 32;

export function isValidPixKey(value: string, type: PixKeyType): boolean {
  switch (type) {
    case "cpf":
      return isValidCPF(value);
    case "cnpj":
      return isValidCNPJ(value);
    case "phone":
      return isValidPhone(value);
    case "email":
      return isValidEmail(value);
    case "random":
      return value.replace(/[^a-zA-Z0-9]/g, "").length === RANDOM_PIX_KEY_LENGTH;
  }
}
