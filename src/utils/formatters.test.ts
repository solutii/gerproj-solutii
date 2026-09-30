import { describe, expect, it } from "vitest";
import {
    applyMask,
    formatCEP,
    formatCNPJ,
    formatCPF,
    formatCreditCard,
    formatCurrency,
    formatDate,
    formatFileSize,
    formatPercentage,
    formatPhoneNumber,
    formatProperCase,
    formatSentenceCase,
    formatTime,
    parseCurrency,
    parsePercentage,
    removeAccents,
    slugify,
    stripPhoneDigits,
} from "./formatters";

describe("stripPhoneDigits", () => {
    it("mantém só dígitos e limita a 11", () => {
        expect(stripPhoneDigits("(31) 99999-8888")).toBe("31999998888");
        expect(stripPhoneDigits("319999988881234")).toBe("31999998888");
    });
});

describe("formatPhoneNumber", () => {
    it("formata progressivamente conforme a quantidade de dígitos", () => {
        expect(formatPhoneNumber("")).toBe("");
        expect(formatPhoneNumber("3")).toBe("(3");
        expect(formatPhoneNumber("31999")).toBe("(31) 999");
        expect(formatPhoneNumber("3199998888")).toBe("(31) 9999-8888");
        expect(formatPhoneNumber("31999998888")).toBe("(31) 99999-8888");
    });
});

describe("formatProperCase", () => {
    it("capitaliza cada palavra, preservando conectivos minúsculos exceto no início", () => {
        expect(formatProperCase("joão da silva")).toBe("João da Silva");
        expect(formatProperCase("DE souza")).toBe("De Souza");
        expect(formatProperCase("maria  eduarda")).toBe("Maria  Eduarda");
    });
});

describe("formatSentenceCase", () => {
    it("capitaliza a primeira letra e após pontuação final", () => {
        expect(formatSentenceCase("bom dia. tudo bem? sim! ótimo.")).toBe(
            "Bom dia. Tudo bem? Sim! Ótimo.",
        );
    });

    it("não capitaliza depois de reticências", () => {
        expect(formatSentenceCase("aguardando... resposta")).toBe(
            "Aguardando... resposta",
        );
    });
});

describe("formatCPF", () => {
    it("aplica a máscara progressivamente", () => {
        expect(formatCPF("123")).toBe("123");
        expect(formatCPF("12345678900")).toBe("123.456.789-00");
    });
});

describe("formatCNPJ", () => {
    it("aplica a máscara progressivamente", () => {
        expect(formatCNPJ("12")).toBe("12");
        expect(formatCNPJ("12345678000199")).toBe("12.345.678/0001-99");
    });
});

describe("formatCEP", () => {
    it("aplica a máscara de CEP", () => {
        expect(formatCEP("30130010")).toBe("30130-010");
        expect(formatCEP("301")).toBe("301");
    });
});

describe("formatCurrency / parseCurrency", () => {
    it("formata centavos digitados como moeda BRL", () => {
        expect(formatCurrency("")).toBe("");
        expect(formatCurrency("100")).toContain("1,00");
    });

    it("faz o caminho inverso corretamente", () => {
        expect(parseCurrency("")).toBe(0);
        expect(parseCurrency("100")).toBe(1);
    });
});

describe("formatPercentage / parsePercentage", () => {
    it("formata e converte de volta", () => {
        expect(formatPercentage("")).toBe("");
        expect(formatPercentage("1050")).toBe("10,50%");
        expect(parsePercentage("1050")).toBe(10.5);
    });
});

describe("formatCreditCard", () => {
    it("agrupa em blocos de 4 dígitos", () => {
        expect(formatCreditCard("4111111111111111")).toBe("4111 1111 1111 1111");
    });
});

describe("formatDate", () => {
    it("aplica a máscara dd/mm/aaaa progressivamente", () => {
        expect(formatDate("31")).toBe("31");
        expect(formatDate("3112")).toBe("31/12");
        expect(formatDate("31122026")).toBe("31/12/2026");
    });
});

describe("formatTime", () => {
    it("aplica a máscara hh:mm", () => {
        expect(formatTime("14")).toBe("14");
        expect(formatTime("1430")).toBe("14:30");
    });
});

describe("removeAccents / slugify", () => {
    it("remove diacríticos", () => {
        expect(removeAccents("São Paulo")).toBe("Sao Paulo");
    });

    it("gera um slug normalizado", () => {
        expect(slugify("  Chamado Nº 15.042! ")).toBe("chamado-n-15042");
    });
});

describe("applyMask", () => {
    it("aplica uma máscara genérica de dígitos", () => {
        expect(applyMask("30130010", "99999-999")).toBe("30130-010");
        expect(applyMask("123", "999-999")).toBe("123");
    });
});

describe("formatFileSize", () => {
    it("escolhe a unidade certa conforme o tamanho", () => {
        expect(formatFileSize(500)).toBe("500 B");
        expect(formatFileSize(2048)).toBe("2.0 KB");
        expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    });
});
