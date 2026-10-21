/**
 * Biblioteca de dibujitos ("sellos"). Cada uno es una lista de primitivas simples en su propia
 * caja [W, H]; al dibujarse se escalan y pasan por rough.js, así combinan con el resto del pizarrón.
 *
 * f: 1 = relleno suave (transparente), 2 = relleno sólido.
 */
export type StampPrim =
  | { c: [number, number, number]; f?: 1 | 2 }
  | { e: [number, number, number, number]; f?: 1 | 2 }
  | { l: [number, number, number, number] }
  | { p: number[]; f?: 1 | 2 }
  | { o: number[] }
  | { k: number[]; f?: 1 | 2 }
  | { r: [number, number, number, number]; f?: 1 | 2 }
  /** arco: cx, cy, w, h, desde°, hasta° (0° = derecha, sentido horario) */
  | { a: [number, number, number, number, number, number] }

export interface StampDef {
  id: string
  name: string
  /** palabras extra para la búsqueda */
  tags: string
  cat: StampCategory
  box: [number, number]
  prims: StampPrim[]
}

export type StampCategory = 'personas' | 'naturaleza' | 'tech' | 'negocios' | 'simbolos' | 'marcos'

export const CATEGORIES: { id: StampCategory; name: string }[] = [
  { id: 'personas', name: 'Personas' },
  { id: 'tech', name: 'Tecnología' },
  { id: 'negocios', name: 'Negocios' },
  { id: 'naturaleza', name: 'Naturaleza' },
  { id: 'simbolos', name: 'Símbolos' },
  { id: 'marcos', name: 'Flechas y marcos' },
]

// ——— helpers para construir figuras ———

function figure(x: number, s = 1, y = 0): StampPrim[] {
  const X = (v: number) => x + (v - 30) * s
  const Y = (v: number) => y + v * s
  return [
    { c: [X(30), Y(16), 22 * s] },
    { l: [X(30), Y(27), X(30), Y(62)] },
    { o: [X(10), Y(53), X(30), Y(38), X(50), Y(53)] },
    { o: [X(14), Y(96), X(30), Y(62), X(46), Y(96)] },
  ]
}

/** Contorno ondulado cerrado (copas de árbol, nubes de pensamiento). */
function blob(cx: number, cy: number, rx: number, ry: number, bumps: number, depth = 0.14): number[] {
  const out: number[] = []
  const n = bumps * 2
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2
    const k = i % 2 === 0 ? 1 - depth : 1
    out.push(cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k)
  }
  return out
}

function star(cx: number, cy: number, R: number, r: number, n = 5): number[] {
  const out: number[] = []
  for (let i = 0; i < n * 2; i++) {
    const t = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const rad = i % 2 === 0 ? R : r
    out.push(cx + Math.cos(t) * rad, cy + Math.sin(t) * rad)
  }
  return out
}

function gear(cx: number, cy: number, R: number, r: number, teeth: number): number[] {
  const out: number[] = []
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const w = (Math.PI * 2) / teeth
    const pts: [number, number][] = [
      [a, r],
      [a + w * 0.18, R],
      [a + w * 0.5, R],
      [a + w * 0.68, r],
    ]
    for (const [ang, rad] of pts) out.push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad)
  }
  return out
}

function heart(cx: number, cy: number, s: number): number[] {
  const out: number[] = []
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    out.push(cx + x * s, cy - y * s)
  }
  return out
}

function rays(cx: number, cy: number, r1: number, r2: number, n: number, offset = 0): StampPrim[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2 + offset
    return { l: [cx + Math.cos(t) * r1, cy + Math.sin(t) * r1, cx + Math.cos(t) * r2, cy + Math.sin(t) * r2] }
  })
}

const S = (id: string, name: string, cat: StampCategory, box: [number, number], prims: StampPrim[], tags = ''): StampDef => ({
  id,
  name,
  cat,
  box,
  prims,
  tags,
})

export const STAMPS: StampDef[] = [
  // ——— Personas ———
  S('persona', 'Persona', 'personas', [60, 100], figure(30), 'monito stick figure hombre mujer usuario'),
  S(
    'saludo',
    'Persona saludando',
    'personas',
    [70, 100],
    [
      { c: [30, 16, 22] },
      { l: [30, 27, 30, 62] },
      { l: [30, 38, 11, 54] },
      { o: [30, 38, 49, 28, 58, 9] },
      { o: [14, 96, 30, 62, 46, 96] },
    ],
    'hola feliz celebrar',
  ),
  S('grupo', 'Grupo', 'personas', [150, 104], [...figure(28, 0.88, 12), ...figure(122, 0.88, 12), ...figure(75, 1.04, 0)], 'equipo personas gente team'),
  S(
    'usuario',
    'Usuario (ícono)',
    'personas',
    [80, 86],
    [{ c: [40, 26, 34] }, { a: [40, 86, 66, 60, 180, 360] }, { l: [7, 86, 73, 86] }],
    'avatar perfil cuenta cliente',
  ),
  S(
    'feliz',
    'Cara feliz',
    'personas',
    [80, 80],
    [{ c: [40, 40, 74] }, { c: [28, 32, 6], f: 2 }, { c: [52, 32, 6], f: 2 }, { a: [40, 44, 40, 30, 20, 160] }],
    'sonrisa emoji contento',
  ),
  S(
    'triste',
    'Cara triste',
    'personas',
    [80, 80],
    [{ c: [40, 40, 74] }, { c: [28, 32, 6], f: 2 }, { c: [52, 32, 6], f: 2 }, { a: [40, 66, 36, 24, 200, 340] }],
    'emoji mal problema',
  ),
  S(
    'pensando',
    'Persona pensando',
    'personas',
    [110, 104],
    [
      ...figure(30, 1, 6),
      { k: blob(84, 26, 24, 17, 6), f: 1 },
      { c: [62, 50, 8] },
      { c: [54, 60, 5] },
    ],
    'idea duda pensar burbuja',
  ),
  S(
    'robot',
    'Robot / IA',
    'personas',
    [90, 100],
    [
      { r: [16, 22, 58, 44] },
      { l: [45, 22, 45, 10] },
      { c: [45, 7, 8], f: 2 },
      { c: [32, 42, 11], f: 2 },
      { c: [58, 42, 11], f: 2 },
      { l: [34, 56, 56, 56] },
      { r: [8, 36, 8, 16] },
      { r: [74, 36, 8, 16] },
      { r: [24, 72, 42, 26], f: 1 },
    ],
    'ia ai bot inteligencia artificial llm modelo',
  ),

  // ——— Tecnología ———
  S(
    'laptop',
    'Laptop',
    'tech',
    [120, 78],
    [
      { r: [22, 6, 76, 50] },
      { r: [29, 13, 62, 36], f: 1 },
      { p: [16, 58, 104, 58, 116, 72, 4, 72] },
      { l: [50, 65, 70, 65] },
    ],
    'computador notebook pc portatil',
  ),
  S(
    'monitor',
    'Monitor',
    'tech',
    [110, 96],
    [{ r: [6, 6, 98, 64] }, { r: [13, 13, 84, 50], f: 1 }, { l: [48, 70, 44, 86] }, { l: [62, 70, 66, 86] }, { l: [30, 88, 80, 88] }],
    'pantalla computador escritorio pc',
  ),
  S(
    'telefono',
    'Teléfono',
    'tech',
    [56, 100],
    [{ r: [6, 4, 44, 92] }, { r: [12, 18, 32, 58], f: 1 }, { l: [22, 11, 34, 11] }, { c: [28, 85, 8] }],
    'celular movil smartphone app',
  ),
  S(
    'servidor',
    'Servidor',
    'tech',
    [90, 108],
    [0, 36, 72].flatMap((y): StampPrim[] => [
      { r: [8, 6 + y, 74, 28] },
      { c: [20, 20 + y, 6], f: 2 },
      { c: [31, 20 + y, 6] },
      { l: [46, 16 + y, 72, 16 + y] },
      { l: [46, 24 + y, 72, 24 + y] },
    ]),
    'backend rack host cpu maquina',
  ),
  S(
    'db',
    'Base de datos',
    'tech',
    [90, 110],
    [
      { e: [45, 16, 74, 22], f: 1 },
      { l: [8, 16, 8, 92] },
      { l: [82, 16, 82, 92] },
      { a: [45, 92, 74, 22, 0, 180] },
      { a: [45, 41, 74, 22, 0, 180] },
      { a: [45, 66, 74, 22, 0, 180] },
    ],
    'database sql postgres cilindro datos almacenamiento',
  ),
  S('nube', 'Nube', 'tech', [130, 80], [{ k: cloud(), f: 1 }], 'cloud aws internet clima'),
  S(
    'engranaje',
    'Engranaje',
    'tech',
    [100, 100],
    [{ p: gear(50, 50, 46, 36, 9) }, { c: [50, 50, 30] }],
    'configuracion ajustes settings proceso',
  ),
  S('codigo', 'Código </>', 'tech', [110, 70], [{ o: [34, 12, 10, 35, 34, 58] }, { o: [76, 12, 100, 35, 76, 58] }, { l: [62, 6, 48, 64] }], 'code programar html dev'),
  S(
    'navegador',
    'Navegador / web',
    'tech',
    [130, 96],
    [
      { r: [4, 4, 122, 88] },
      { l: [4, 24, 126, 24] },
      { c: [15, 14, 7] },
      { c: [27, 14, 7] },
      { c: [39, 14, 7] },
      { r: [52, 9, 64, 10] },
      { l: [16, 42, 92, 42] },
      { l: [16, 56, 112, 56] },
      { l: [16, 70, 70, 70] },
    ],
    'web pagina sitio browser frontend chrome',
  ),
  S(
    'cubo',
    'Caja / API',
    'tech',
    [100, 100],
    [{ p: [50, 8, 90, 28, 50, 48, 10, 28], f: 1 }, { o: [10, 28, 10, 72, 50, 92, 90, 72, 90, 28] }, { l: [50, 48, 50, 92] }],
    'api servicio modulo paquete contenedor docker',
  ),
  S(
    'candado',
    'Candado',
    'tech',
    [80, 100],
    [{ a: [40, 46, 40, 64, 180, 360] }, { r: [12, 44, 56, 50], f: 1 }, { c: [40, 63, 10], f: 2 }, { l: [40, 66, 40, 80] }],
    'seguridad auth login privado bloqueo',
  ),
  S(
    'chip',
    'Chip',
    'tech',
    [90, 90],
    [
      { r: [20, 20, 50, 50] },
      { r: [32, 32, 26, 26], f: 1 },
      ...[32, 45, 58].flatMap((v): StampPrim[] => [
        { l: [v, 6, v, 20] },
        { l: [v, 70, v, 84] },
        { l: [6, v, 20, v] },
        { l: [70, v, 84, v] },
      ]),
    ],
    'cpu gpu procesador hardware',
  ),
  S(
    'wifi',
    'Wifi',
    'tech',
    [90, 70],
    [{ a: [45, 64, 84, 84, 225, 315] }, { a: [45, 64, 56, 56, 225, 315] }, { a: [45, 64, 28, 28, 225, 315] }, { c: [45, 62, 8], f: 2 }],
    'internet red conexion señal',
  ),
  S(
    'cohete',
    'Cohete',
    'tech',
    [70, 120],
    [
      { k: [35, 4, 50, 22, 54, 54, 52, 86, 18, 86, 16, 54, 20, 22, 35, 4] },
      { c: [35, 44, 16] },
      { p: [18, 62, 4, 92, 18, 86] },
      { p: [52, 62, 66, 92, 52, 86] },
      { k: [24, 90, 28, 106, 35, 116, 42, 106, 46, 90], f: 1 },
    ],
    'lanzamiento startup deploy rapido',
  ),

  // ——— Negocios ———
  S(
    'barras',
    'Gráfico de barras',
    'negocios',
    [110, 90],
    [{ o: [8, 4, 8, 84, 106, 84] }, { r: [20, 50, 16, 34], f: 1 }, { r: [46, 30, 16, 54], f: 1 }, { r: [72, 12, 16, 72], f: 1 }],
    'chart estadisticas crecimiento datos',
  ),
  S(
    'lineas',
    'Gráfico de líneas',
    'negocios',
    [110, 90],
    [{ o: [8, 4, 8, 84, 106, 84] }, { o: [18, 70, 42, 46, 64, 56, 94, 16] }, { c: [42, 46, 6], f: 2 }, { c: [64, 56, 6], f: 2 }, { c: [94, 16, 6], f: 2 }],
    'chart tendencia crecimiento metricas',
  ),
  S(
    'torta',
    'Gráfico de torta',
    'negocios',
    [90, 90],
    [{ c: [45, 45, 84] }, { l: [45, 45, 45, 3] }, { l: [45, 45, 84, 60] }, { l: [45, 45, 10, 70] }],
    'pie chart porcentaje',
  ),
  S(
    'moneda',
    'Dinero',
    'negocios',
    [90, 90],
    [
      { c: [45, 45, 84] },
      { c: [45, 45, 66] },
      { k: [57, 30, 48, 25, 37, 28, 34, 37, 43, 45, 52, 49, 57, 58, 51, 65, 40, 66, 32, 60] },
      { l: [45, 18, 45, 72] },
    ],
    'plata money peso dolar ventas ingresos',
  ),
  S(
    'calendario',
    'Calendario',
    'negocios',
    [96, 96],
    [
      { r: [6, 12, 84, 78] },
      { l: [6, 30, 90, 30] },
      { l: [27, 4, 27, 20] },
      { l: [69, 4, 69, 20] },
      ...[46, 62, 78].flatMap((y): StampPrim[] => [26, 48, 70].map((x): StampPrim => ({ c: [x, y, 6], f: 2 }))),
    ],
    'fecha agenda dia mes plazo',
  ),
  S(
    'reloj',
    'Reloj',
    'negocios',
    [90, 90],
    [{ c: [45, 45, 82] }, { o: [45, 20, 45, 45, 63, 55] }, ...rays(45, 45, 33, 38, 4, -Math.PI / 2)],
    'tiempo hora espera rapido',
  ),
  S(
    'diana',
    'Objetivo',
    'negocios',
    [90, 90],
    [{ c: [45, 45, 84] }, { c: [45, 45, 54] }, { c: [45, 45, 22], f: 1 }, { l: [45, 45, 80, 10] }, { o: [70, 8, 80, 10, 82, 20] }],
    'meta target diana foco',
  ),
  S(
    'trofeo',
    'Trofeo',
    'negocios',
    [90, 100],
    [
      { k: [20, 8, 22, 36, 45, 58, 68, 36, 70, 8] },
      { l: [20, 8, 70, 8] },
      { k: [20, 16, 6, 18, 8, 34, 24, 40] },
      { k: [70, 16, 84, 18, 82, 34, 66, 40] },
      { l: [45, 58, 45, 76] },
      { r: [28, 76, 34, 10] },
      { r: [22, 86, 46, 10], f: 1 },
    ],
    'ganador premio exito copa',
  ),
  S('documento', 'Documento', 'negocios', [76, 100], [
    { p: [6, 4, 52, 4, 70, 22, 70, 96, 6, 96] },
    { o: [52, 4, 52, 22, 70, 22] },
    { l: [18, 40, 58, 40] },
    { l: [18, 54, 58, 54] },
    { l: [18, 68, 50, 68] },
    { l: [18, 82, 38, 82] },
  ], 'archivo pdf hoja papel contrato'),
  S('carpeta', 'Carpeta', 'negocios', [110, 84], [{ p: [4, 14, 40, 14, 48, 24, 106, 24, 106, 80, 4, 80], f: 1 }, { l: [4, 32, 106, 32] }], 'folder archivos directorio'),
  S('correo', 'Correo', 'negocios', [110, 76], [{ r: [4, 4, 102, 68] }, { o: [4, 6, 55, 44, 106, 6] }], 'email mail mensaje sobre'),
  S('casa', 'Casa', 'negocios', [100, 100], [
    { r: [18, 46, 64, 50] },
    { p: [8, 48, 50, 10, 92, 48] },
    { r: [42, 66, 16, 30], f: 1 },
    { r: [24, 56, 12, 12] },
    { r: [64, 56, 12, 12] },
    { o: [68, 29, 68, 14, 78, 14, 78, 38] },
  ], 'hogar inicio home edificio'),

  // ——— Naturaleza ———
  S(
    'arbol',
    'Árbol',
    'naturaleza',
    [90, 116],
    [{ k: blob(45, 42, 40, 38, 7), f: 1 }, { o: [38, 112, 40, 76] }, { o: [52, 112, 50, 76] }, { l: [16, 112, 74, 112] }],
    'arbolito planta bosque',
  ),
  S(
    'pino',
    'Pino',
    'naturaleza',
    [70, 104],
    [
      { p: [35, 4, 50, 28, 42, 28, 58, 52, 46, 52, 66, 80, 4, 80, 24, 52, 12, 52, 28, 28, 20, 28], f: 1 },
      { r: [29, 80, 12, 18] },
      { l: [10, 98, 60, 98] },
    ],
    'arbol navidad bosque',
  ),
  S('sol', 'Sol', 'naturaleza', [100, 100], [{ c: [50, 50, 44], f: 1 }, ...rays(50, 50, 30, 46, 10)], 'dia clima verano luz'),
  S(
    'montana',
    'Montaña',
    'naturaleza',
    [120, 80],
    [{ p: [4, 76, 40, 20, 58, 44, 78, 12, 116, 76] }, { o: [67, 30, 72, 34, 78, 28, 83, 34, 89, 30] }],
    'cerro paisaje cima meta',
  ),
  S(
    'flor',
    'Flor',
    'naturaleza',
    [64, 100],
    [
      ...Array.from({ length: 6 }, (_, i): StampPrim => {
        const t = (i / 6) * Math.PI * 2
        return { c: [32 + Math.cos(t) * 14, 28 + Math.sin(t) * 14, 17] }
      }),
      { c: [32, 28, 13], f: 2 },
      { k: [32, 44, 30, 70, 33, 98] },
      { k: [31, 76, 42, 64, 54, 66, 45, 77, 31, 76], f: 1 },
    ],
    'planta primavera jardin',
  ),
  S('estrella', 'Estrella', 'simbolos', [100, 96], [{ p: star(50, 52, 46, 19), f: 1 }], 'favorito destacado rating'),
  S('corazon', 'Corazón', 'simbolos', [100, 90], [{ k: heart(50, 44, 2.8), f: 1 }], 'amor like me gusta'),
  S('check', 'Check', 'simbolos', [100, 80], [{ o: [8, 44, 36, 72, 92, 8] }], 'listo ok correcto si visto'),
  S('cruz', 'Cruz', 'simbolos', [80, 80], [{ l: [10, 10, 70, 70] }, { l: [70, 10, 10, 70] }], 'no error mal incorrecto x'),
  S(
    'pregunta',
    'Pregunta',
    'simbolos',
    [60, 100],
    [{ k: [12, 30, 14, 15, 30, 6, 46, 12, 50, 28, 42, 42, 30, 50, 30, 66] }, { c: [30, 88, 9], f: 2 }],
    'duda signo interrogacion',
  ),
  S('exclamacion', 'Exclamación', 'simbolos', [30, 100], [{ o: [15, 8, 15, 66] }, { c: [15, 88, 9], f: 2 }], 'alerta importante ojo atencion'),
  S('rayo', 'Rayo', 'simbolos', [70, 110], [{ p: [42, 4, 10, 62, 34, 62, 26, 106, 62, 42, 38, 42, 50, 4], f: 1 }], 'energia rapido electricidad poder'),
  S(
    'bombilla',
    'Idea',
    'simbolos',
    [80, 86],
    [
      { c: [40, 36, 42] },
      { l: [30, 52, 32, 68] },
      { l: [50, 52, 48, 68] },
      { r: [31, 68, 18, 14] },
      { l: [31, 75, 49, 75] },
      { o: [33, 50, 36, 40, 40, 47, 44, 40, 47, 50] },
      { l: [40, 2, 40, 9] },
      { l: [12, 12, 17, 17] },
      { l: [68, 12, 63, 17] },
      { l: [3, 36, 11, 36] },
      { l: [77, 36, 69, 36] },
    ],
    'ampolleta bombilla luz pensar',
  ),
  S('lupa', 'Lupa', 'simbolos', [90, 90], [{ c: [36, 36, 56] }, { l: [56, 56, 84, 84] }, { l: [60, 54, 86, 80] }], 'buscar busqueda search'),
  S(
    'pin',
    'Ubicación',
    'simbolos',
    [64, 96],
    [{ k: [32, 92, 14, 56, 8, 32, 16, 14, 32, 6, 48, 14, 56, 32, 50, 56, 32, 92] }, { c: [32, 32, 20] }],
    'mapa lugar gps pin',
  ),
  S('bandera', 'Bandera', 'simbolos', [70, 100], [{ l: [10, 96, 10, 6] }, { p: [10, 8, 64, 8, 54, 24, 64, 40, 10, 40], f: 1 }], 'meta hito objetivo llegada'),
  S(
    'globo',
    'Mundo',
    'simbolos',
    [90, 90],
    [{ c: [45, 45, 82] }, { e: [45, 45, 36, 82] }, { l: [4, 45, 86, 45] }, { k: [11, 24, 45, 30, 79, 24] }, { k: [11, 66, 45, 60, 79, 66] }],
    'internet global planeta tierra',
  ),
  S(
    'ojo',
    'Ojo',
    'simbolos',
    [110, 64],
    [{ k: [4, 32, 30, 8, 55, 4, 80, 8, 106, 32, 80, 56, 55, 60, 30, 56, 4, 32] }, { c: [55, 32, 32] }, { c: [55, 32, 12], f: 2 }],
    'ver vista mirar visible',
  ),

  // ——— Flechas y marcos ———
  S('flecha-curva', 'Flecha curva', 'marcos', [120, 70], [{ k: [8, 62, 28, 24, 66, 10, 104, 30] }, { o: [86, 18, 106, 32, 86, 44] }], 'curva siguiente paso'),
  S('flecha-doble', 'Flecha doble', 'marcos', [140, 40], [{ l: [10, 20, 130, 20] }, { o: [26, 6, 10, 20, 26, 34] }, { o: [114, 6, 130, 20, 114, 34] }], 'ida vuelta intercambio sync'),
  S(
    'flecha-ciclo',
    'Ciclo',
    'marcos',
    [100, 100],
    [{ a: [50, 50, 76, 76, 315, 605] }, { o: [25, 28, 34, 16, 20, 13] }],
    'loop repetir proceso refresh',
  ),
  S('dialogo', 'Burbuja de diálogo', 'marcos', [120, 92], [{ p: [12, 4, 108, 4, 116, 12, 116, 58, 108, 66, 46, 66, 24, 88, 30, 66, 12, 66, 4, 58, 4, 12] }], 'globo texto decir chat comentario'),
  S(
    'pensamiento',
    'Burbuja de pensamiento',
    'marcos',
    [120, 100],
    [{ k: blob(64, 38, 54, 32, 8) }, { c: [30, 80, 16] }, { c: [16, 94, 9] }],
    'pensar idea nube',
  ),
  S('nota', 'Nota adhesiva', 'marcos', [100, 100], [{ p: [6, 6, 94, 6, 94, 74, 74, 94, 6, 94], f: 1 }, { o: [74, 94, 77, 77, 94, 74] }], 'post-it sticky recordatorio'),
  S('llave', 'Llave {', 'marcos', [40, 120], [{ k: [34, 4, 22, 8, 20, 30, 18, 52, 6, 60, 18, 68, 20, 90, 22, 112, 34, 116] }], 'agrupar corchete'),
  S('ondulado', 'Subrayado ondulado', 'marcos', [160, 24], [{ k: [4, 14, 24, 6, 44, 18, 64, 6, 84, 18, 104, 6, 124, 18, 144, 6, 156, 12] }], 'enfasis subrayar'),
  S(
    'encerrar',
    'Encerrar',
    'marcos',
    [170, 90],
    [{ k: [34, 14, 86, 5, 146, 14, 164, 44, 138, 78, 76, 86, 18, 74, 6, 42, 24, 16, 64, 6] }],
    'circulo resaltar marcar destacar',
  ),
]

/** Nube con base plana y "chichones" arriba. */
function cloud(): number[] {
  return [
    24, 72, 10, 64, 8, 50, 18, 40, 30, 38, 34, 24, 48, 14, 64, 14, 76, 22, 84, 16, 98, 18, 108, 30, 108, 40, 120, 46, 122,
    60, 114, 70, 102, 72, 24, 72,
  ]
}

export const STAMP_MAP = new Map(STAMPS.map((s) => [s.id, s]))
