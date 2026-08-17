// Generador de scripts ETL en Python (Google Colab) derivados de la
// validación previa al cargue. Un ETL distinto por cada tipo de cargue.

export type EtlField = {
  columna: string;
  target?: string;
  required?: boolean;
  type: "text" | "digits" | "number" | "date" | "email";
  minLen?: number;
  maxLen?: number;
  min?: number;
  max?: number;
  normalize?: "phone" | "phone-strict";
  unique?: boolean;
  hint: string;
  ejemplo?: string;
};

export type EtlSpec = {
  tipo: string;
  titulo: string;
  archivoSalida: string;
  dateFormat: "DD-MM-YYYY" | "YYYY-MM-DD";
  fields: EtlField[];
};

const py = (v: unknown): string => {
  if (v === undefined || v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
};

function fieldsBlock(fields: EtlField[]): string {
  return fields
    .map((f) => {
      const parts = [
        `"columna": ${py(f.columna)}`,
        `"target": ${py(f.target ?? f.columna)}`,
        `"required": ${py(!!f.required)}`,
        `"type": ${py(f.type)}`,
        `"min_len": ${py(f.minLen)}`,
        `"max_len": ${py(f.maxLen)}`,
        `"min": ${py(f.min)}`,
        `"max": ${py(f.max)}`,
        `"normalize": ${py(f.normalize)}`,
        `"unique": ${py(!!f.unique)}`,
        `"hint": ${py(f.hint)}`,
        `"ejemplo": ${py(f.ejemplo ?? "")}`,
      ];
      return `    {${parts.join(", ")}},`;
    })
    .join("\n");
}

export function buildEtlScript(spec: EtlSpec): string {
  const cols = spec.fields.map((f) => f.columna);
  return `# =====================================================================
# ETL — ${spec.titulo}  (cargue: ${spec.tipo})
# Control de Líneas · script generado desde la validación previa al cargue
# Ejecutar en Google Colab: https://colab.research.google.com
#
# Objetivo: tomar un archivo Excel/CSV "sucio" y devolver un archivo que
# pase la validación previa de este cargue sin errores.
#
# Pasos en Colab:
#   1. Ejecuta la celda. El script te pedirá que anexes (suba) tu archivo.
#   2. Haz clic en "Elegir archivos" y selecciona tu Excel/CSV.
#   3. Espera a que termine el procesamiento y se descargue el archivo limpio.
#   4. Sube el archivo limpio en la sección "Cargar Archivos" de la app.
# =====================================================================

!pip -q install pandas openpyxl xlsxwriter

import re
import unicodedata
import pandas as pd

# ------------------------- Configuración -----------------------------
ARCHIVO_SALIDA = "${spec.archivoSalida}"
FORMATO_FECHA = "${spec.dateFormat}"
HOJA = 0                                   # hoja de Excel (nombre o índice)

# Si tus encabezados no coinciden, mapea:  "MI_ENCABEZADO": "COLUMNA_DESTINO"
MAPEO_COLUMNAS = {}

# Definición de campos derivada 1:1 de la validación previa de la app.
CAMPOS = [
${fieldsBlock(spec.fields)}
]

COLUMNAS = [${cols.map((c) => py(c)).join(", ")}]

# Indicativos telefónicos ITU (E.164). Se ordenan de más largo a más corto.
COUNTRY_CODES = [
    "1","7","20","27","30","31","32","33","34","36","39","40","41","43","44","45","46","47","48","49",
    "51","52","53","54","55","56","57","58","60","61","62","63","64","65","66","81","82","84","86","90",
    "91","92","93","94","95","98","211","212","213","216","218","220","221","222","223","224","225","226",
    "227","228","229","230","231","232","233","234","235","236","237","238","239","240","241","242","243",
    "244","245","246","247","248","249","250","251","252","253","254","255","256","257","258","260","261",
    "262","263","264","265","266","267","268","269","290","291","297","298","299","350","351","352","353",
    "354","355","356","357","358","359","370","371","372","373","374","375","376","377","378","380","381",
    "382","383","385","386","387","389","420","421","423","500","501","502","503","504","505","506","507",
    "508","509","590","591","592","593","594","595","596","597","598","599","670","672","673","674","675",
    "676","677","678","679","680","681","682","683","685","686","687","688","689","690","691","692","850",
    "852","853","855","856","880","886","960","961","962","963","964","965","966","967","968","970","971",
    "972","973","974","975","976","977","992","993","994","995","996",
]
SORTED_CODES = sorted(COUNTRY_CODES, key=lambda c: (-len(c), -int(c)))
NATIONAL_MIN, NATIONAL_MAX = 7, 12


# --------------------------- Utilidades ------------------------------
def norm_key(s):
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def normalize_phone(value):
    """Quita el indicativo de país de cualquier país y deja el número nacional."""
    if value is None:
        return ""
    raw = str(value).strip()
    if not raw or re.search(r"[a-zA-Z]", raw):
        return ""
    digits = re.sub(r"\\D", "", raw)
    if not digits:
        return ""
    if raw.startswith("00"):
        digits = digits[2:]
    for code in SORTED_CODES:
        if digits.startswith(code) and len(digits) > len(code):
            rest = digits[len(code):]
            if NATIONAL_MIN <= len(rest) <= NATIONAL_MAX:
                return rest
    return digits


def coerce_phone(value):
    """Versión tolerante: conserva el original si trae letras (para alertas)."""
    if value is None:
        return ""
    raw = str(value).strip()
    if not raw:
        return ""
    if re.search(r"[a-zA-Z]", raw):
        return raw
    return normalize_phone(raw) or raw


def coerce_date(value, fmt):
    if value is None or str(value).strip() == "":
        return ""
    ts = pd.to_datetime(value, errors="coerce", dayfirst=(fmt == "DD-MM-YYYY"))
    if pd.isna(ts):
        return ""
    return ts.strftime("%d-%m-%Y" if fmt == "DD-MM-YYYY" else "%Y-%m-%d")


def coerce_number(value):
    if value is None or str(value).strip() == "":
        return ""
    s = re.sub(r"[^0-9,.\\-]", "", str(value))
    if s.count(",") and s.count("."):
        s = s.replace(".", "").replace(",", ".")   # 1.234.567,89
    elif s.count(","):
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return ""


def only_digits(value):
    return re.sub(r"\\D", "", str(value or ""))


# ------------------------- 1. EXTRACT --------------------------------
print("=" * 60)
print("PASO 1: ANEXA TU ARCHIVO EXCEL/CSV")
print("=" * 60)
print("Haz clic en 'Elegir archivos' abajo y selecciona tu archivo fuente.")
print("")

from google.colab import files
uploaded = files.upload()

if not uploaded:
    raise SystemExit("No se anexó ningún archivo. Ejecuta de nuevo la celda.")

ARCHIVO_ENTRADA = list(uploaded.keys())[0]
print(f"Archivo anexado: {ARCHIVO_ENTRADA}")

if ARCHIVO_ENTRADA.lower().endswith(".csv"):
    df = pd.read_csv(ARCHIVO_ENTRADA, dtype=str, keep_default_na=False, sep=None, engine="python")
else:
    df = pd.read_excel(ARCHIVO_ENTRADA, sheet_name=HOJA, dtype=str)

df = df.fillna("")
print("Filas leídas:", len(df))

# Resolver encabezados reales -> columnas esperadas (ignora tildes/espacios/caso)
mapa_manual = {norm_key(k): v for k, v in MAPEO_COLUMNAS.items()}
origen_por_columna = {}
for real in df.columns:
    k = norm_key(real)
    destino = mapa_manual.get(k)
    if destino is None:
        for col in COLUMNAS:
            if norm_key(col) == k:
                destino = col
                break
    if destino is not None and destino not in origen_por_columna:
        origen_por_columna[destino] = real

faltantes = [c for c in COLUMNAS if c not in origen_por_columna]
if faltantes:
    print("Columnas no encontradas (se crearán vacías):", faltantes)


# ------------------------ 2. TRANSFORM -------------------------------
salida = pd.DataFrame()
for campo in CAMPOS:
    col = campo["columna"]
    origen = origen_por_columna.get(col)
    serie = df[origen] if origen else pd.Series([""] * len(df))
    serie = serie.astype(str).str.strip()

    if campo["normalize"] == "phone-strict":
        serie = serie.map(normalize_phone)
    elif campo["normalize"] == "phone":
        serie = serie.map(coerce_phone)
    elif campo["type"] == "date":
        serie = serie.map(lambda v: coerce_date(v, FORMATO_FECHA))
    elif campo["type"] == "number":
        serie = serie.map(coerce_number)
    elif campo["type"] == "digits":
        serie = serie.map(only_digits)
    else:
        if campo["max_len"]:
            serie = serie.str.slice(0, campo["max_len"])
    salida[col] = serie


# ------------------------ 3. VALIDATE --------------------------------
errores = []          # filas que la app rechazaría
advertencias = []     # valores opcionales inválidos que se vacían

for campo in CAMPOS:
    col, tipo = campo["columna"], campo["type"]
    for i, valor in salida[col].items():
        fila = i + 2  # +2 = encabezado + índice base 0
        vacio = str(valor).strip() == ""

        if vacio:
            if campo["required"]:
                errores.append((fila, col, "obligatorio vacío", campo["hint"]))
            continue

        motivo = None
        if tipo == "digits":
            s = only_digits(valor)
            if not s:
                motivo = "no contiene dígitos"
            elif campo["min_len"] and len(s) < campo["min_len"]:
                motivo = f"longitud {len(s)}, mínimo {campo['min_len']}"
            elif campo["max_len"] and len(s) > campo["max_len"]:
                motivo = f"longitud {len(s)}, máximo {campo['max_len']}"
        elif tipo == "number":
            try:
                n = float(valor)
                if campo["min"] is not None and n < campo["min"]:
                    motivo = f"menor que {campo['min']}"
                if campo["max"] is not None and n > campo["max"]:
                    motivo = f"mayor que {campo['max']}"
            except (TypeError, ValueError):
                motivo = "no es numérico"
        elif tipo == "date":
            if str(valor).strip() == "":
                motivo = "fecha inválida"
        elif tipo == "email":
            if not re.match(r"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", str(valor)):
                motivo = "correo inválido"
        else:
            if campo["max_len"] and len(str(valor)) > campo["max_len"]:
                motivo = f"excede {campo['max_len']} caracteres"
            if campo["min_len"] and len(str(valor)) < campo["min_len"]:
                motivo = f"mínimo {campo['min_len']} caracteres"

        if motivo:
            if campo["required"]:
                errores.append((fila, col, motivo, campo["hint"]))
            else:
                advertencias.append((fila, col, motivo))
                salida.at[i, col] = ""   # opcional inválido -> se limpia

filas_con_error = sorted({f for f, *_ in errores})
limpio = salida.drop(index=[f - 2 for f in filas_con_error], errors="ignore").reset_index(drop=True)

print(f"Filas válidas: {len(limpio)}  |  descartadas: {len(filas_con_error)}  |  avisos: {len(advertencias)}")
if errores:
    print("\\nPrimeros 20 errores:")
    for fila, col, motivo, hint in errores[:20]:
        print(f"  fila {fila} · {col}: {motivo} — {hint}")


# --------------------------- 4. LOAD ---------------------------------
with pd.ExcelWriter(ARCHIVO_SALIDA, engine="xlsxwriter") as writer:
    limpio.to_excel(writer, index=False, sheet_name="Datos")
    if errores:
        pd.DataFrame(errores, columns=["fila", "columna", "motivo", "regla"]).to_excel(
            writer, index=False, sheet_name="Errores"
        )
    if advertencias:
        pd.DataFrame(advertencias, columns=["fila", "columna", "motivo"]).to_excel(
            writer, index=False, sheet_name="Avisos"
        )

print("Archivo generado:", ARCHIVO_SALIDA)

try:
    from google.colab import files
    files.download(ARCHIVO_SALIDA)
except Exception:
    pass
`;
}
