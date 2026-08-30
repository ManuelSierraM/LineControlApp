// Generador de scripts ETL en Python (Google Colab) derivados del TEMPLATE
// guía de cada cargue: mismas columnas, mismo orden, mismo formato de ejemplo.
// Objetivo: simple y efectivo — no rechaza filas, solo ordena y limpia.

export type EtlField = {
  columna: string;
  requerido?: boolean;
  ejemplo?: string;
  nota?: string;
  /** Nombres alternativos con los que puede venir la columna en el archivo origen. */
  alias?: string[];
  /** Limpieza ligera aplicada a la columna. */
  formato?: "texto" | "telefono" | "fecha" | "digitos" | "numero";
  /** Extracción previa al limpiador (ej. IMEI a la izquierda del "@"). */
  extraer?: "antes_arroba" | "primeros6";
};

export type EtlSpec = {
  tipo: string;
  titulo: string;
  archivoSalida: string;
  dateFormat: "DD-MM-YYYY" | "YYYY-MM-DD";
  fields: EtlField[];
  /** Filtro de filas sobre una columna del archivo origen (comparación exacta, sin tildes/mayúsculas). */
  filtro?: { columna: string; alias: string[]; valor: string };
};

const py = (v: unknown): string => {
  if (v === undefined || v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `[${v.map(py).join(", ")}]`;
  return `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
};

function fieldsBlock(fields: EtlField[]): string {
  return fields
    .map(
      (f) =>
        `    {"columna": ${py(f.columna)}, "formato": ${py(f.formato ?? "texto")}, "requerido": ${py(
          !!f.requerido,
        )}, "alias": ${py(f.alias ?? [])}, "ejemplo": ${py(f.ejemplo ?? "")}, "extraer": ${py(f.extraer ?? "")}},`,
    )
    .join("\n");
}


export function buildEtlScript(spec: EtlSpec): string {
  return `# =====================================================================
# ETL de formateo — ${spec.titulo}  (cargue: ${spec.tipo})
# Control de Líneas · script generado a partir del TEMPLATE guía
#
# Qué hace:
#   1. Lees tu Excel/CSV con las columnas que sea (pueden sobrar o faltar).
#   2. El script busca las columnas del template (ignora tildes, espacios,
#      mayúsculas y guiones bajos) y arma un archivo con EXACTAMENTE las
#      columnas del template, en el mismo orden.
#   3. Aplica limpieza ligera: quita espacios, quita el indicativo de país en
#      los teléfonos y normaliza las fechas al formato del template.
#   4. NO elimina filas. Al final te muestra un resumen de campos vacíos en
#      las columnas obligatorias para que los revises antes de subir.
#
# Pasos en Google Colab (https://colab.research.google.com):
#   1. Pega este código en una celda y ejecútala.
#   2. Haz clic en "Elegir archivos" y anexa tu Excel/CSV.
#   3. Se descarga el archivo limpio; súbelo en "Cargar Archivos" de la app.
# =====================================================================

!pip -q install pandas openpyxl xlsxwriter

import re
import unicodedata
import pandas as pd

# ------------------------- Configuración -----------------------------
ARCHIVO_SALIDA = "${spec.archivoSalida}"
FORMATO_FECHA = "${spec.dateFormat}"
HOJA = 0                      # hoja de Excel (nombre o índice)

# Si algún encabezado tuyo no se reconoce, mapéalo aquí:
#   MAPEO_COLUMNAS = {"CELULAR": "TELE_NUMB"}
MAPEO_COLUMNAS = {}

# Filtro de filas sobre una columna del archivo origen (o None para no filtrar).
FILTRO = ${spec.filtro ? `{"columna": ${py(spec.filtro.columna)}, "valor": ${py(spec.filtro.valor)}, "alias": ${py(spec.filtro.alias)}}` : "None"}

# Columnas del template guía de este cargue (mismo orden).
CAMPOS = [
${fieldsBlock(spec.fields)}
]
COLUMNAS = [c["columna"] for c in CAMPOS]

# Indicativos telefónicos ITU (E.164), del más largo al más corto.
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


# --------------------------- Utilidades ------------------------------
def norm_key(s):
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def limpiar_texto(v):
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() in ("nan", "none", "nat"):
        return ""
    # Excel a veces entrega números como "123.0"
    if re.fullmatch(r"-?\\d+\\.0", s):
        s = s[:-2]
    return s


def limpiar_telefono(v):
    s = limpiar_texto(v)
    if not s:
        return ""
    if re.search(r"[a-zA-Z]", s):
        return s                       # se conserva tal cual para revisión
    digits = re.sub(r"\\D", "", s)
    if not digits:
        return ""
    explicito = s.startswith("+") or s.startswith("00")
    if s.startswith("00"):
        digits = digits[2:]
    # Solo se quita el indicativo si el número viene con prefijo internacional
    # explícito (+ / 00) o si es más largo que un número nacional (>10 dígitos).
    if not explicito and len(digits) <= 10:
        return digits
    for code in SORTED_CODES:
        if digits.startswith(code) and len(digits) > len(code):
            resto = digits[len(code):]
            if 7 <= len(resto) <= 12:
                return resto
    return digits



def limpiar_fecha(v):
    s = limpiar_texto(v)
    if not s:
        return ""
    # Quita sufijos tipo "(UTC -5)" que traen algunas plataformas
    s = re.sub(r"\\s*\\(UTC[^)]*\\)", "", s).strip()
    # Fecha serial de Excel
    if re.fullmatch(r"\\d{5}", s):
        ts = pd.to_datetime(int(s), unit="D", origin="1899-12-30", errors="coerce")
    else:
        # Los archivos origen suelen venir en DD-MM-YYYY (formato Colombia)
        ts = pd.to_datetime(s, errors="coerce", dayfirst=True)
        if pd.isna(ts):
            ts = pd.to_datetime(s, errors="coerce", dayfirst=False)
    if pd.isna(ts):
        return s
    return ts.strftime("%d-%m-%Y" if FORMATO_FECHA == "DD-MM-YYYY" else "%Y-%m-%d")


def limpiar_digitos(v):
    s = limpiar_texto(v)
    if not s:
        return ""
    if re.search(r"[eE]\\+", s):        # notación científica de Excel
        try:
            s = format(float(s), ".0f")
        except ValueError:
            pass
    return re.sub(r"\\D", "", s)


def limpiar_numero(v):
    s = limpiar_texto(v)
    if not s:
        return ""
    s = re.sub(r"[^0-9,.\\-]", "", s)
    if s.count(",") and s.count("."):
        s = s.replace(".", "").replace(",", ".")     # 1.234.567,89
    elif s.count(","):
        s = s.replace(",", ".")
    elif re.fullmatch(r"-?\\d{1,3}(\\.\\d{3})+", s):
        s = s.replace(".", "")                       # 45.000 -> 45000

    try:
        n = float(s)
    except ValueError:
        return ""
    return int(n) if n == int(n) else n


LIMPIADORES = {
    "texto": limpiar_texto,
    "telefono": limpiar_telefono,
    "fecha": limpiar_fecha,
    "digitos": limpiar_digitos,
    "numero": limpiar_numero,
}


# ------------------------- 1. ANEXAR ARCHIVO -------------------------
print("=" * 60)
print("PASO 1: ANEXA TU ARCHIVO EXCEL/CSV")
print("=" * 60)

from google.colab import files
uploaded = files.upload()
if not uploaded:
    raise SystemExit("No se anexó ningún archivo. Ejecuta de nuevo la celda.")

ARCHIVO_ENTRADA = list(uploaded.keys())[0]
print("Archivo anexado:", ARCHIVO_ENTRADA)

if ARCHIVO_ENTRADA.lower().endswith(".csv"):
    df = pd.read_csv(ARCHIVO_ENTRADA, dtype=str, keep_default_na=False, sep=None, engine="python")
else:
    df = pd.read_excel(ARCHIVO_ENTRADA, sheet_name=HOJA, dtype=str)

df = df.fillna("")
df.columns = [str(c) for c in df.columns]
print("Filas leídas:", len(df), "| columnas del archivo:", len(df.columns))


# ---------------------- 1.5 FILTRO DE FILAS --------------------------
if FILTRO:
    llaves = [norm_key(FILTRO["columna"])] + [norm_key(a) for a in FILTRO.get("alias", [])]
    col_filtro = next((c for c in df.columns if norm_key(c) in llaves), None)
    if col_filtro:
        antes = len(df)
        df = df[df[col_filtro].astype(str).str.strip().str.lower() == str(FILTRO["valor"]).strip().lower()]
        df = df.reset_index(drop=True)
        print(f'Filtro aplicado: {col_filtro} = "{FILTRO["valor"]}" -> {len(df)} de {antes} filas conservadas')
    else:
        print(f'ADVERTENCIA: no se encontró la columna de filtro "{FILTRO["columna"]}"; no se filtró.')


# ------------------ 2. EMPAREJAR CON EL TEMPLATE ---------------------
mapa_manual = {norm_key(k): v for k, v in MAPEO_COLUMNAS.items()}

# Nombre exacto del template y sus alias conocidos del archivo origen.
mapa_alias = {}
for campo in CAMPOS:
    mapa_alias.setdefault(norm_key(campo["columna"]), campo["columna"])
    for a in campo.get("alias", []):
        mapa_alias.setdefault(norm_key(a), campo["columna"])

origen_por_columna = {}
for real in df.columns:
    k = norm_key(real)
    destino = mapa_manual.get(k) or mapa_alias.get(k)
    if destino is not None and destino not in origen_por_columna:
        origen_por_columna[destino] = real


encontradas = [c for c in COLUMNAS if c in origen_por_columna]
faltantes = [c for c in COLUMNAS if c not in origen_por_columna]
print("Columnas reconocidas:", encontradas)
if faltantes:
    print("Columnas NO encontradas (se crean vacías):", faltantes)
    print("Si existen con otro nombre, agrégalas en MAPEO_COLUMNAS y vuelve a ejecutar.")


# --------------------------- 3. LIMPIAR ------------------------------
salida = pd.DataFrame(index=df.index)
for campo in CAMPOS:
    col = campo["columna"]
    origen = origen_por_columna.get(col)
    serie = df[origen] if origen else pd.Series([""] * len(df), index=df.index)
    if campo.get("extraer") == "antes_arroba":
        # Extrae el valor a la izquierda del "@" (ej. IMEI dentro de un correo).
        serie = serie.map(lambda v: str(v).split("@")[0] if "@" in str(v) else str(v))
    if campo.get("extraer") == "primeros6":
        # Conserva solo los primeros 6 caracteres (ej. código de delegación).
        serie = serie.map(lambda v: str(v).strip()[:6])
    salida[col] = serie.map(LIMPIADORES.get(campo["formato"], limpiar_texto))

salida = salida[COLUMNAS]


# --------------------------- 4. RESUMEN ------------------------------
print("")
print("Resumen de columnas obligatorias:")
hay_pendientes = False
for campo in CAMPOS:
    if not campo["requerido"]:
        continue
    col = campo["columna"]
    vacios = int((salida[col].astype(str).str.strip() == "").sum())
    estado = "OK" if vacios == 0 else f"{vacios} fila(s) vacías — revisar"
    if vacios:
        hay_pendientes = True
    print(f"  - {col}: {estado}")
if not hay_pendientes:
    print("  Todas las obligatorias vienen completas.")


# --------------------------- 5. GUARDAR ------------------------------
with pd.ExcelWriter(ARCHIVO_SALIDA, engine="xlsxwriter") as writer:
    salida.to_excel(writer, index=False, sheet_name="Datos")

print("")
print("Archivo generado:", ARCHIVO_SALIDA, "| filas:", len(salida))

try:
    files.download(ARCHIVO_SALIDA)
except Exception:
    pass
`;
}
