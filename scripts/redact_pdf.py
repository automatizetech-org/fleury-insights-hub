import re
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python scripts/redact_pdf.py <input.pdf> <output.pdf>")
        return 2

    in_path = sys.argv[1]
    out_path = sys.argv[2]
    mode = (sys.argv[3] if len(sys.argv) >= 4 else "safe").strip().lower()
    aggressive = mode in ("aggressive", "total", "full")

    try:
        import fitz  # PyMuPDF
    except Exception as e:  # pragma: no cover
        print("PyMuPDF (fitz) not installed:", e)
        return 3

    cpf_re = re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b")
    cnpj_re = re.compile(r"\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b")
    cnpj_digits_re = re.compile(r"\b\d{2}[.\-]?\d{3}[.\-]?\d{3}[\/\-]?\d{4}[.\-]?\d{2}\b")
    # RG (variantes comuns): "12.345.678-9" e também sem pontuação.
    rg_re = re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}-?\d{1,2}\b")
    rg_digits_re = re.compile(r"\b\d{7,9}\b")
    # S/N (sem número): pode vir como "S/N" ou "SN" dependendo do PDF/extrator.
    sn_re = re.compile(r"^(S/?N|SN)$", re.IGNORECASE)
    cep_re = re.compile(r"\b\d{2}\.\d{3}-\d{3}\b|\b\d{5}-\d{3}\b")
    numberish_re = re.compile(r"^\d{2,}([./-]\d+)*$")
    email_re = re.compile(r".+@.+\..+")

    # Palavras-chave que geralmente indicam dados sensíveis.
    # Importante: evitar tarjar palavras genéricas demais (ex.: "RUA") como palavra isolada,
    # senão o documento fica ilegível. A tarja de "imóvel" será feita por bloco de texto.
    sensitive_keywords = {
        "CPF",
        "CPF/MF",
        "CPF/ME",
        "CNPJ",
        "RG",
        "ENDEREÇO",
        "ENDERECO",
        "NÚMERO",
        "NUMERO",
        "APARTAMENTO",
        "EDIFÍCIO",
        "EDIFICIO",
        "CEP",
        "MATRÍCULA",
        "MATRICULA",
        "CARTÓRIO",
        "CARTORIO",
        "REGISTRO",
        "IMÓVEL",
        "IMOVEL",
        "OAB/GO",
        "OAB",
    }

    # Nomes sensíveis (lista explícita para evitar tarjar termos genéricos).
    # Normalize: palavras em CAIXA ALTA, sem acentos no match por palavra.
    explicit_sensitive_names = {
        # Machado Holding
        "OSVALDO",
        "MACHADO",
        "PEDRO",
        "AUGUSTO",
        "ALVES",
        "GRACIANE",
        "ROMANOWSKI",
        "MACHADO",
        # Flamaluan
        "FLAVIA",
        "BATISTA",
        "PEREIRA",
        "ANDRADE",
        "FLAMALUAN",
        "PARTICIPACOES",
        "MICHELY",
        "CARVALHO",
        # Observação: não incluímos termos genéricos como "LTDA"/"HOLDING" para evitar tarjar demais.
    }

    # Heurística: blocos com descrições de imóveis (tarjados por bloco, não por página inteira)
    property_block_keywords = {
        "IMÓVEL",
        "IMOVEL",
        "MATRÍCULA",
        "MATRICULA",
        "CARTÓRIO",
        "CARTORIO",
        "REGISTRO DE IMÓVEIS",
        "REGISTRO DE IMOVEIS",
        "LOTE",
        "QUADRA",
        "APARTAMENTO",
        "EDIFÍCIO",
        "EDIFICIO",
        "BAIRRO",
        "JARDIM",
        "SETOR",
        "AVENIDA",
        "RUA",
        "CEP",
        "GOIÂNIA",
        "GOIANIA",
        "GOIÁS",
        "GOIAS",
        "VALOR",
        "AV-",
        "R-",
    }

    # Marcadores de blocos que quase sempre são dados sensíveis de identificação/assinatura.
    # No modo agressivo, tarja o bloco inteiro apenas quando esses marcadores existirem.
    identity_block_markers = {
        "CPF",
        "CPF/",
        "RG",
        "SSP",
        "CNPJ",
        "OAB",
        "ASSINATURA",
        "ASSINANTE",
        "E-MAIL",
        "EMAIL",
        "OAB/GO",
        "OAB",
    }

    # Heurística de nome: duas ou mais palavras em CAIXA ALTA (ex.: "FULANO DE TAL").
    # No modo agressivo, isso é considerado sensível (nome de pessoa/empresa).
    upper_name_re = re.compile(
        r"\b[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}(?:\s+(?:DE|DA|DO|DAS|DOS|E)\s+)?[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,}(?:\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{2,})*\b"
    )

    # Padrões típicos de endereço (tarjar bloco quando parecer "endereço completo")
    street_re = re.compile(r"\b(rua|avenida|alameda|travessa|rodovia|estrada)\b", re.IGNORECASE)
    addr_num_re = re.compile(r"\b(n[ºo]\.?|número|numero)\b", re.IGNORECASE)
    # Número de endereço costuma ser um token curto (ex.: 123, 1234, 1234-A).
    addr_house_number_token_re = re.compile(r"^\d{1,6}([\-\/]\d{1,4})?[A-Z]?$", re.IGNORECASE)
    city_uf_re = re.compile(r"\b(goi[aâ]nia|santo\s+ant[oô]nio\s+de\s+goi[aá]s)\b", re.IGNORECASE)
    uf_re = re.compile(r"\bGO\b")
    quadra_lote_re = re.compile(r"\b(QD\.?|LT\.?|QUADRA|LOTE)\b", re.IGNORECASE)
    qd_marker_re = re.compile(r"^(QD|QUADRA)\.?$", re.IGNORECASE)
    lt_marker_re = re.compile(r"^(LT|LOTE)\.?$", re.IGNORECASE)
    # Casos onde o extrator junta marcador+valor em um token (ex.: "QD.18", "LT.10")
    qd_lt_inline_value_re = re.compile(r"^(QD|QUADRA|LT|LOTE)\.?\d{1,4}$", re.IGNORECASE)
    # Números curtos de endereço (ex.: 18, 10)
    short_addr_number_re = re.compile(r"^\d{1,4}$")
    # Segmentos que aparecem em endereços
    address_segment_keywords = {
        "RUA",
        "AVENIDA",
        "ALAMEDA",
        "TRAVESSA",
        "RODOVIA",
        "ESTRADA",
        "ENDERECO",
        "ENDEREÇO",
        "QD",
        "QUADRA",
        "LT",
        "LOTE",
        "SETOR",
        "SUL",
        "NORTE",
        "LESTE",
        "OESTE",
    }

    def looks_like_full_address(block_text: str) -> bool:
        t = block_text or ""
        if not street_re.search(t):
            return False
        # exige "número/nº" OU CEP OU um volume de dígitos típico (quadra/lote/CEP)
        digits = re.sub(r"\D", "", t)
        has_addr_number = bool(addr_num_re.search(t))
        has_cep = bool(cep_re.search(t))
        has_city = bool(city_uf_re.search(t) or uf_re.search(t))
        has_quad_lote = bool(quadra_lote_re.search(t))
        return (
            has_cep
            or (has_addr_number and has_city)
            or (has_addr_number and has_quad_lote)
            or (has_quad_lote and has_cep)
            or (len(digits) >= 8 and has_city)
        )

    doc = fitz.open(in_path)
    for page in doc:
        # 1) Tarja por blocos quando o bloco contém dados de imóvel.
        # Isso evita “página toda preta”.
        blocks = page.get_text("blocks")  # (x0, y0, x1, y1, "text", block_no, block_type)
        for x0, y0, x1, y1, btxt, *_ in blocks:
            if not btxt:
                continue
            upper_block = str(btxt).upper()
            # Não tarjar bloco inteiro por "IMÓVEL": isso costuma apagar texto genérico da página.
            # Mantemos endereços por heurística (looks_like_full_address) e entidades por regex/palavras abaixo.

            # 1b) Tarja blocos que parecem conter endereço completo
            if looks_like_full_address(btxt):
                page.add_redact_annot(fitz.Rect(x0, y0, x1, y1), fill=(0, 0, 0))
                continue
            # Em modo agressivo, evitamos tarjar bloco inteiro por identidade/nome para não borrar
            # palavras genéricas. As entidades sensíveis serão tarjadas por palavra (CPF/CNPJ/endereço/nome explícito).

        # 2) Tarja pontual (CPF, e-mail, nomes, tokens sensíveis) por palavra.

        words = page.get_text("words")  # (x0,y0,x1,y1,"word",...)
        # Ordena para permitir heurística de "palavra anterior"
        words_sorted = sorted(words, key=lambda t: (t[1], t[0]))

        tokens = []
        for item in words_sorted:
            x0, y0, x1, y1, w, *_ = item
            if not w:
                continue
            raw = str(w).strip()
            # Normaliza para regex quando o extrator vem com pontuação grudada (ex.: "...,", "....")
            raw_clean = raw.strip().strip(".,;:")
            raw_no_spaces = re.sub(r"\s+", "", raw_clean)
            upper = raw_clean.upper()
            tokens.append((x0, y0, x1, y1, raw_clean, raw_no_spaces, upper))

        # 2a) Heurística: quando acharmos um marcador de via (RUA/AVENIDA/...)
        # e também aparecerem componentes de endereço (Nº/SN/QD/LT) logo depois,
        # tarjamos a faixa daquela linha para não deixar apenas "parte" (ex.: só S/N ou só QD).
        addr_segment_mask = [False] * len(tokens)
        street_markers = {
            "RUA",
            "AVENIDA",
            "ALAMEDA",
            "TRAVESSA",
            "RODOVIA",
            "ESTRADA",
            "ENDERECO",
            "ENDEREÇO",
        }
        for j, t in enumerate(tokens):
            x0, y0, x1, y1, raw_clean, raw_no_spaces, upper = t
            if upper not in street_markers:
                continue

            win_end = min(len(tokens), j + 18)
            window = tokens[j:win_end]
            strong_found = False
            for wt in window:
                _wx0, _wy0, _wx1, _wy1, w_raw_clean, w_raw_no_spaces, w_upper = wt
                if sn_re.match(w_raw_no_spaces):
                    strong_found = True
                    break
                if addr_num_re.match(w_upper):
                    strong_found = True
                    break
                if qd_marker_re.match(w_upper) or lt_marker_re.match(w_upper):
                    strong_found = True
                    break
                if qd_lt_inline_value_re.match(w_raw_no_spaces):
                    strong_found = True
                    break
                if short_addr_number_re.match(w_raw_no_spaces) and len(w_raw_no_spaces) <= 2:
                    # números curtinhos podem ser "QD.18" / "LT.10" quando o marcador vem separado
                    # (mantemos como fraco, só serve se houver outro sinal forte na janela)
                    pass

            if not strong_found:
                continue

            # Marca a faixa inteira como redutível, mas só aplicaremos tarja
            # quando a palavra parecer um componente de endereço.
            for k in range(j, win_end):
                _kx0, _ky0, _kx1, _ky1, _raw_clean, _raw_no_spaces, _upper = tokens[k]
                if (
                    _upper in address_segment_keywords
                    or sn_re.match(_raw_no_spaces)
                    or qd_marker_re.match(_upper)
                    or lt_marker_re.match(_upper)
                    or qd_lt_inline_value_re.match(_raw_no_spaces)
                    or addr_num_re.match(_upper)
                    or short_addr_number_re.match(_raw_no_spaces)
                ):
                    addr_segment_mask[k] = True

        def window_has_street_marker(upper_tokens: list[str]) -> bool:
            # Evita depender de blocos: se está perto de "RUA/AVENIDA/..." é forte indício.
            joined = " ".join(upper_tokens)
            return (
                "RUA" in joined
                or "AVENIDA" in joined
                or "ALAMEDA" in joined
                or "TRAVESSA" in joined
                or "RODOVIA" in joined
                or "ESTRADA" in joined
                or "ENDERECO" in joined
                or "ENDEREÇO" in joined
            )

        for i, (x0, y0, x1, y1, raw_clean, raw_no_spaces, upper) in enumerate(tokens):

            redact = False

            if cpf_re.match(raw_no_spaces):
                redact = True
            elif cnpj_re.match(raw_no_spaces) or cnpj_digits_re.match(raw_no_spaces):
                redact = True
            elif rg_re.match(raw_no_spaces) or rg_digits_re.match(raw_no_spaces):
                redact = True
            elif cep_re.match(raw_no_spaces):
                redact = True
            elif email_re.match(raw_clean) and "@" in raw_clean:
                redact = True
            elif upper in explicit_sensitive_names:
                redact = True
            elif upper in sensitive_keywords:
                redact = True
            elif numberish_re.match(raw_no_spaces) and len(re.sub(r"\D", "", raw_no_spaces)) >= 8:
                # números longos costumam ser matrículas, CEPs, etc.
                redact = True

            # 3) Heurística para o número do endereço:
            # - se o token é um número curto e vem logo após "Nº"/"NÚMERO"/"NUMERO",
            # - ou aparece perto de palavras de endereço (RUA/AVENIDA/...)
            if not redact and addr_house_number_token_re.match(raw_no_spaces):
                prev_upper = tokens[i - 1][6] if i - 1 >= 0 else ""
                if addr_num_re.match(prev_upper):
                    redact = True
                else:
                    window = [t[6] for t in tokens[max(0, i - 3):min(len(tokens), i + 1)]]
                    if window_has_street_marker(window):
                        redact = True

            # 4) Máscara de segmento de endereço (faixa após RUA...)
            if not redact and addr_segment_mask[i]:
                redact = True
            # Em modo agressivo, não usamos heurística genérica por nome em caixa alta.

            if redact:
                rect = fitz.Rect(x0, y0, x1, y1)
                page.add_redact_annot(rect, fill=(0, 0, 0))

        page.apply_redactions()

    doc.save(out_path)
    doc.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

