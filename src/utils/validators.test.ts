import { describe, expect, it } from "vitest";
import {
    getCreditCardBrand,
    getPasswordStrength,
    getPasswordStrengthScore,
    hasMaxLength,
    hasMinLength,
    isValidCNPJ,
    isValidCPF,
    isValidCreditCard,
    isValidDate,
    isValidEmail,
    isValidPassword,
    isValidPhone,
    isValidPixKey,
    isValidTime,
} from "./validators";

describe("isValidEmail", () => {
    it("aceita e-mails válidos", () => {
        expect(isValidEmail("rogerio.jlf@gmail.com")).toBe(true);
        expect(isValidEmail("user.name+tag@sub.dominio.com.br")).toBe(true);
    });

    it("rejeita e-mails inválidos", () => {
        expect(isValidEmail("sem-arroba.com")).toBe(false);
        expect(isValidEmail("com@espaco em branco.com")).toBe(false);
        expect(isValidEmail("")).toBe(false);
    });
});

describe("isValidPhone", () => {
    it("aceita telefones com 10 ou 11 dígitos", () => {
        expect(isValidPhone("(31) 3333-4444")).toBe(true);
        expect(isValidPhone("(31) 99999-8888")).toBe(true);
    });

    it("rejeita quantidade errada de dígitos", () => {
        expect(isValidPhone("123")).toBe(false);
    });
});

describe("hasMinLength / hasMaxLength", () => {
    it("ignora espaços nas pontas ao validar o tamanho", () => {
        expect(hasMinLength("  abc  ", 3)).toBe(true);
        expect(hasMinLength("ab", 3)).toBe(false);
        expect(hasMaxLength("  abc  ", 3)).toBe(true);
        expect(hasMaxLength("abcd", 3)).toBe(false);
    });
});

describe("isValidCPF", () => {
    it("aceita um CPF válido", () => {
        expect(isValidCPF("111.444.777-35")).toBe(true);
    });

    it("rejeita CPF com dígito verificador errado", () => {
        expect(isValidCPF("111.444.777-36")).toBe(false);
    });

    it("rejeita CPF com todos os dígitos iguais", () => {
        expect(isValidCPF("111.111.111-11")).toBe(false);
    });

    it("rejeita CPF com quantidade errada de dígitos", () => {
        expect(isValidCPF("123")).toBe(false);
    });
});

describe("isValidCNPJ", () => {
    it("aceita um CNPJ válido", () => {
        expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    });

    it("rejeita CNPJ com dígito verificador errado", () => {
        expect(isValidCNPJ("11.222.333/0001-82")).toBe(false);
    });

    it("rejeita CNPJ com todos os dígitos iguais", () => {
        expect(isValidCNPJ("11.111.111/1111-11")).toBe(false);
    });
});

describe("isValidCreditCard (Luhn)", () => {
    it("aceita um número que passa no algoritmo de Luhn", () => {
        expect(isValidCreditCard("4111 1111 1111 1111")).toBe(true);
    });

    it("rejeita um número que não passa no Luhn", () => {
        expect(isValidCreditCard("4111 1111 1111 1112")).toBe(false);
    });

    it("rejeita tamanhos fora do intervalo válido", () => {
        expect(isValidCreditCard("123")).toBe(false);
    });
});

describe("getCreditCardBrand", () => {
    it("identifica a bandeira pelo prefixo", () => {
        expect(getCreditCardBrand("4111111111111111")).toBe("visa");
        expect(getCreditCardBrand("5500000000000004")).toBe("mastercard");
        expect(getCreditCardBrand("340000000000009")).toBe("amex");
        expect(getCreditCardBrand("6011000000000004")).toBe("discover");
        expect(getCreditCardBrand("9999999999999999")).toBe("unknown");
    });
});

describe("isValidDate", () => {
    it("aceita datas válidas no formato dd/mm/aaaa", () => {
        expect(isValidDate("29/02/2024")).toBe(true); // ano bissexto
        expect(isValidDate("31/12/2026")).toBe(true);
    });

    it("rejeita datas inválidas", () => {
        expect(isValidDate("29/02/2026")).toBe(false); // não é bissexto
        expect(isValidDate("31/04/2026")).toBe(false); // abril não tem 31
        expect(isValidDate("2026-12-31")).toBe(false); // formato errado
    });
});

describe("isValidTime", () => {
    it("aceita horários válidos", () => {
        expect(isValidTime("00:00")).toBe(true);
        expect(isValidTime("23:59")).toBe(true);
    });

    it("rejeita horários inválidos", () => {
        expect(isValidTime("24:00")).toBe(false);
        expect(isValidTime("12:60")).toBe(false);
        expect(isValidTime("1200")).toBe(false);
    });
});

describe("força de senha", () => {
    it("classifica a força corretamente", () => {
        expect(getPasswordStrengthScore("abc")).toBe(0);
        expect(getPasswordStrength("abc")).toBe("fraca");
        expect(getPasswordStrength("abcdefgh1")).toBe("média");
        expect(getPasswordStrength("Abcdefgh1")).toBe("forte");
        expect(getPasswordStrength("Abcdefghij1!")).toBe("muito forte");
    });

    it("isValidPassword exige minúscula, maiúscula, dígito e símbolo", () => {
        expect(isValidPassword("Abcdefg1!")).toBe(true);
        expect(isValidPassword("abcdefg1!")).toBe(false); // sem maiúscula
        expect(isValidPassword("Abcdefgh")).toBe(false); // sem dígito/símbolo
    });
});

describe("isValidPixKey", () => {
    it("valida cada tipo de chave delegando ao validador correto", () => {
        expect(isValidPixKey("111.444.777-35", "cpf")).toBe(true);
        expect(isValidPixKey("rogerio.jlf@gmail.com", "email")).toBe(true);
        expect(isValidPixKey("(31) 99999-8888", "phone")).toBe(true);
        expect(isValidPixKey("a".repeat(32), "random")).toBe(true);
        expect(isValidPixKey("a".repeat(31), "random")).toBe(false);
    });
});
