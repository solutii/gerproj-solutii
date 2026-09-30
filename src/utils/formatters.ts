//===== FUNÇÃO PARA FORMATAR NÚMEROS DE TELEFONE =====//
export function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatPhoneNumber(value: string): string {
  const digits = stripPhoneDigits(value);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR NOMES =====//
const LOWERCASE_WORDS = [
  "a",
  "e",
  "i",
  "o",
  "u",
  "da",
  "de",
  "di",
  "do",
  "du",
  "das",
  "des",
  "dis",
  "dos",
  "dus",
];

function capitalizeWord(word: string): string {
  return (
    word.charAt(0).toLocaleUpperCase("pt-BR") +
    word.slice(1).toLocaleLowerCase("pt-BR")
  );
}

export function formatProperCase(value: string): string {
  let wordIndex = 0;

  return value
    .split(/(\s+)/)
    .map((part) => {
      if (part === "" || /^\s+$/.test(part)) return part;

      const lower = part.toLocaleLowerCase("pt-BR");
      const isException = LOWERCASE_WORDS.includes(lower);
      const formatted =
        wordIndex > 0 && isException ? lower : capitalizeWord(part);

      wordIndex++;
      return formatted;
    })
    .join("");
}

// -------------------------------------------------------------------------------------

// ==== FUNÇÃO PARA FORMATAR FRASES =====//
function isLetter(char: string): boolean {
  return /[a-zà-öø-ÿ]/i.test(char);
}

export function formatSentenceCase(value: string): string {
  let capitalizeNext = true;
  let dotStreak = 0;
  let result = "";

  for (const char of value) {
    if (capitalizeNext && isLetter(char)) {
      result += char.toLocaleUpperCase("pt-BR");
      capitalizeNext = false;
    } else {
      result += char;
    }

    if (char === ".") {
      dotStreak++;
      // "..." (reticências) não deve capitalizar a próxima letra.
      capitalizeNext = dotStreak < 3;
    } else {
      if (char === "!" || char === "?") {
        capitalizeNext = true;
      }
      if (!/\s/.test(char)) {
        dotStreak = 0;
      }
    }
  }

  return result;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR CPF =====//
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR CNPJ =====//
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR CEP =====//
export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR MOEDA (BRL) =====//
export function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const amount = Number(digits) / 100;

  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseCurrency(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR PERCENTUAL =====//
export function formatPercentage(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const amount = Number(digits) / 100;

  return `${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function parsePercentage(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR CARTÃO DE CRÉDITO =====//
export function formatCreditCard(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  const groups = digits.match(/.{1,4}/g) ?? [];

  return groups.join(" ");
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR DATA =====//
export function formatDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR HORA =====//
export function formatTime(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA REMOVER ACENTOS / SLUGIFY =====//
export function removeAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function slugify(value: string): string {
  return removeAccents(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA APLICAR MÁSCARA GENÉRICA =====//
// Use "9" no padrão para cada dígito esperado. Ex.: "999.999.999-99"
export function applyMask(value: string, mask: string): string {
  const digits = value.replace(/\D/g, "");
  let result = "";
  let digitIndex = 0;

  for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
    const maskChar = mask[i];

    if (maskChar === "9") {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += maskChar;
    }
  }

  return result;
}

// -------------------------------------------------------------------------------------

// ===== FUNÇÃO PARA FORMATAR TAMANHO DE ARQUIVO =====//
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -------------------------------------------------------------------------------------
