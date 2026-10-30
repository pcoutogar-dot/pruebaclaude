"""Contenido de «Inglés para valientes».

Convención de pronunciación (se explica en las páginas 6 y 7 del libro):
  - Tilde siempre en la sílaba fuerte: «uóter», «fiftíin» (15) frente a «fífti» (50).
  - ii = i larga y tensa (sheep → «shiip»); i = i corta, casi una e (ship → «ship»).
  - j = h inglesa, suave como un suspiro: «jáu» (how).
  - z = th de «thank»: «zánk iú». d = th de «the»: «de».
  - sh = «shhh» de mandar callar. dy = j inglesa de «juice»: «dyuus».
  - v = v de verdad, dientes sobre el labio. u = w: «uán» (one).
  - s- al principio = empieza con s, sin e delante: «s-pík».
  - Las consonantes finales se escriben y se pronuncian siempre.
"""
from build import (chap_opener, sec, p, frases, vocab, vocab3, oiras, dialogo, truco, caja, datos, lista, audio,
                   locales, sonidos, checklist, spot, raw, e, J, JD, M, H, MINT, INK)

TITULO_WEB = "Inglés para valientes"
LIBRO = "Inglés para valientes"


def pg(kind, body, run=None, **kw):
    d = {"kind": kind, "body": body, "run": run}
    d.update(kw)
    return d


def bloque(*partes):
    return "".join(partes)


# ======================================================================= portada
PORTADA = '''<div class="page cover">
  <svg class="art" viewBox="0 0 100 150" aria-hidden="true">
    <circle cx="70" cy="110" r="21" fill="#F4B63F"/>
    <g fill="#0A403A">
      <rect x="12" y="113" width="22" height="5"/><rect x="14.5" y="109.5" width="17" height="3.5"/>
      <path d="M16.5 109.5 Q23 91 29.5 109.5 Z"/><rect x="21.4" y="97.5" width="3.2" height="2"/><path d="M22 97.5 L23 84 L24 97.5 Z"/>
      <path d="M44 99 C39 96 35 97 33 100 C37 98.5 40 98.8 44 99 Z"/><path d="M44 99 C49 95.5 53 96.5 55 99.5 C51 98 48 98.2 44 99 Z"/>
      <path d="M44 99 C42 94 38 92.5 35.5 93 C39 94.5 41.5 96 44 99 Z"/><path d="M44 99 C46.5 94 50 92.5 52.5 93.5 C49 94.5 46.5 96.5 44 99 Z"/>
    </g>
    <path d="M41 118.5 Q40.5 108 44 99" stroke="#0A403A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <rect x="0" y="118" width="100" height="32" fill="#0A403A"/>
    <path d="M0 126 C12 123 22 129 34 126 S56 123 68 126 S90 129 100 126 V150 H0 Z" fill="#083631"/>
    <path d="M30 133 q3 -1.5 6 0 M36 139 q3 -1.5 6 0 M28 145 q3 -1.5 6 0" stroke="#2A7C70" stroke-width=".6" fill="none" stroke-linecap="round"/>
    <path d="M48 150 C48 130 56 122.5 70 122.5 C84 122.5 92 130 92 150 Z" fill="#C93D6A"/>
    <g fill="#FBE3EB"><circle cx="60" cy="139" r="1.4"/><circle cx="81" cy="142" r="1.4"/><circle cx="72" cy="147" r="1.4"/><circle cx="86" cy="135.5" r="1.4"/><circle cx="57" cy="147.5" r="1.4"/></g>
    <rect x="67" y="114" width="6" height="9.5" fill="#E5AD86"/><path d="M65 122.8 L70 129.5 L75 122.8 Z" fill="#F2C9A5"/>
    <path d="M54.5 128 C50.5 123 48.8 118 48.5 113 L53 112.2 C53.5 117 55.8 121.5 59 124.5 Z" fill="#B23460"/><circle cx="50.6" cy="109.8" r="3.3" fill="#F2C9A5"/>
    <g fill="#E6ECEA"><circle cx="70" cy="103.5" r="11"/><circle cx="60.2" cy="108.5" r="3.6"/><circle cx="79.8" cy="108.5" r="3.6"/><circle cx="62.5" cy="97.5" r="3.4"/><circle cx="77.5" cy="97.5" r="3.4"/></g>
    <ellipse cx="70" cy="108" rx="8" ry="9" fill="#F2C9A5"/>
    <path d="M61.6 104.5 C63 97.5 67.5 96.4 71.5 96.8 C76 97.3 78.8 100.2 78.6 104.5 C75 101.2 68.5 100.8 61.6 104.5 Z" fill="#E6ECEA"/>
    <g fill="#17302C"><rect x="63.2" y="97.2" width="5.4" height="2.8" rx="1.2"/><rect x="71.4" y="97.2" width="5.4" height="2.8" rx="1.2"/><rect x="68.4" y="98" width="3.2" height=".7"/></g>
    <path d="M65 107.6 q1.5 -1.7 3 0 M72 107.6 q1.5 -1.7 3 0" stroke="#17302C" stroke-width=".75" fill="none" stroke-linecap="round"/>
    <path d="M66.5 111.4 Q70 115.8 73.5 111.4 Z" fill="#FFFFFF" stroke="#17302C" stroke-width=".6" stroke-linejoin="round"/>
    <circle cx="64.6" cy="110.6" r="1.4" fill="#EE9A92"/><circle cx="75.4" cy="110.6" r="1.4" fill="#EE9A92"/>
    <rect x="80" y="87.5" width="17.5" height="9" rx="3" fill="#FFFFFF"/><path d="M83.2 96.2 L80.4 101 L86.4 96.4 Z" fill="#FFFFFF"/>
    <text x="88.75" y="93.8" text-anchor="middle" font-family="Bricolage Grotesque, system-ui, sans-serif" font-weight="800" font-size="4.3" fill="#0A403A">Hello!</text>
  </svg>
  <div class="in">
    <span class="kicker">Inglés desde cero | Después de los 50</span>
    <h2>Inglés<br>para<span>valientes</span></h2>
    <p class="sub">Lo que necesitas decir y entender para vivir tranquila en el Sudeste Asiático.</p>
    <div class="perks"><span>Con audios</span><span>Pronunciación fácil</span><span>Letra grande</span></div>
  </div>
  <div class="countries">Tailandia<br>Vietnam<br>Filipinas</div>
</div>'''

CONTRA = '''<div class="page back"><div class="in">
  <h3>No necesitas un inglés perfecto. Necesitas que te entiendan.</h3>
  <p>Un libro escrito para quien empieza de cero después de los 50 y quiere vivir una temporada en Tailandia, Vietnam o Filipinas sin miedo a abrir la boca.</p>
  <ul>
    <li>Cientos de frases para el hospital, la casa, el dinero, la calle y los amigos</li>
    <li>La pronunciación escrita como suena, sin símbolos raros</li>
    <li>El inglés que de verdad oirás allí, explicado</li>
    <li>Audios con código QR y tarjetas para recortar</li>
  </ul>
  <p>Ábrelo por la página que necesites. Practica en voz alta. Y llévalo en el bolso.</p>
  <div class="bar"><span class="price">Inglés<br>para valientes</span><span class="isbn">Espacio para<br>el código de barras</span></div>
</div></div>'''


# ======================================================================= carta
def carta():
    tazas = f'''<svg class="cups" viewBox="0 0 84 26" aria-hidden="true">
      <path d="M30 6 C40 -1 52 -1 60 4" stroke="{J}" stroke-width=".7" stroke-dasharray="1.6 1.6" fill="none"/>
      <path d="M60.5 1.6 L66 3.6 L60.5 5.4 L61.6 3.6 Z" fill="{J}"/><rect x="4" y="24" width="76" height="1.2" rx=".6" fill="{MINT}"/>
      <path d="M14 11 H28 V18 C28 21 25.5 23 21 23 C16.5 23 14 21 14 18 Z" fill="{J}"/><path d="M28 13 C31.5 13 31.5 18.5 28 18.5" stroke="{J}" stroke-width="1.2" fill="none"/>
      <path d="M18 9 C17 7.5 19 6.5 18 5 M22.5 9 C21.5 7.5 23.5 6.5 22.5 5" stroke="#4A5E58" stroke-width=".6" fill="none" stroke-linecap="round"/>
      <path d="M44 12 H57 V18.5 C57 21.3 54.6 23 50.5 23 C46.4 23 44 21.3 44 18.5 Z" fill="{H}"/><path d="M57 14 C60.3 14 60.3 19 57 19" stroke="{H}" stroke-width="1.2" fill="none"/>
      <path d="M48 10 C47 8.5 49 7.5 48 6 M52.5 10 C51.5 8.5 53.5 7.5 52.5 6" stroke="#4A5E58" stroke-width=".6" fill="none" stroke-linecap="round"/></svg>'''
    a = bloque('<h3>Antes de empezar</h3>',
               p('Me llamo <span class="ph">[Tu nombre]</span> y no soy profesor de inglés. Soy hijo. Eso sí, he viajado por el Sudeste Asiático y sé lo que se siente al llegar a un sitio donde no entiendes nada.'),
               p('Hace poco mi madre se jubiló. Después de toda una vida trabajando y cuidando de los demás, por fin tenía tiempo para ella. Un día, tomando un café, me dijo que le apetecía viajar, irse una temporada a algún sitio nuevo. Y enseguida añadió:'),
               '<p class="said">«Pero claro, yo no sé inglés».</p>',
               p('Esa frase se me quedó dentro. Empecé a leer a gente en su misma situación: cientos de personas de cincuenta, sesenta y setenta años que sueñan con Tailandia, con Vietnam o con Filipinas, y que escriben casi lo mismo. <em>«Me encantaría, pero el idioma me frena».</em>'),
               tazas)
    b = bloque(p('Si tienes este libro en las manos, es posible que tú también lo hayas pensado. Quizá te da vergüenza equivocarte, o crees que a tu edad ya no se aprende, o te imaginas en una farmacia sin saber explicar lo que te pasa.'),
               p('Quiero decirte algo: no necesitas un inglés perfecto. Lo he visto en mis viajes. Allí casi nadie lo habla perfecto, y aun así la gente se entiende. Necesitas unas pocas frases bien elegidas, entender lo que te van a decir y perder el miedo a abrir la boca.'),
               p('Lo he escrito pensando en mi madre. Con letra grande, sin gramática, con la pronunciación escrita como suena y con audios para escucharlos las veces que haga falta.'),
               '<div class="promise"><span>Este libro es para que te entiendan.</span><span>Para que tú entiendas.</span><span>Y para que pierdas el miedo.</span></div>',
               p('Ojalá dentro de unos meses me escribas desde un mercado de Chiang Mai o desde la playa de Da Nang para contarme que te entendieron a la primera.'),
               '<div class="sign"><small>Con cariño,</small><span class="ph">[Tu nombre]</span></div>')
    return [pg("page", a, LIBRO, cls="letter", lbl="Carta al lector"), pg("page", b, LIBRO, cls="letter", lbl="Carta al lector")]


# ======================================================================= cómo usar
def como_usar():
    a = bloque('<h3>Cómo usar este libro</h3>',
               p('No hace falta leerlo de principio a fin: ábrelo por la situación que vayas a vivir mañana.'),
               '<div class="legend"><span>Así está hecha cada frase</span><span>Se dice</span></div>',
               frases([("Slowly, please.", "Slóuli, pliis", "Más despacio, por favor.")]),
               lista(["<b>Arriba, en negrita</b>: la frase en inglés, tal como se escribe. Es la que puedes enseñar escrita.",
                      "<b>En amarillo</b>: cómo se pronuncia, escrito a la española. Léelo en voz alta tal cual.",
                      "<b>Debajo, en gris</b>: lo que significa."]),
               oiras("Así lo oirás allí", "En los recuadros rosas está el inglés que te van a decir, que muchas veces es más corto o diferente al de los libros.",
                     [("Same same", "Igual, parecido.")]),
               truco("", "Los recuadros amarillos son trucos de gente que ya vive allí. Te ahorrarán sustos y dinero."),
               lista(["<b>Tu objetivo no es hablar bien. Es que te entiendan.</b> Con frases cortas, una sonrisa y el móvil a mano, lo vas a conseguir."]))
    b = bloque('<h3>Cómo escuchar los audios</h3>',
               p('Cada lección tiene un código cuadrado como este. Al escanearlo con el móvil se abre una página con todas las frases grabadas.'),
               audio(0, "Prueba con este. Te llevará a la bienvenida."),
               '<ul class="check">'
               '<li><span>Abre la <b>cámara</b> del móvil, la misma que usas para hacer fotos.<small>No hace falta instalar nada.</small></span></li>'
               '<li><span>Apunta al código, como si fueras a hacerle una foto.<small>Mantén el móvil quieto un par de segundos.</small></span></li>'
               '<li><span>Aparece un enlace en la pantalla. <b>Tócalo</b>.<small>Se abre la página de audios de esa lección.</small></span></li>'
               '<li><span>Pulsa el botón de cada frase y repítela en voz alta.<small>Las veces que quieras. Nadie te oye.</small></span></li></ul>',
               truco("¿No funciona?", "Escribe en el navegador la dirección que aparece debajo de cada código. Lleva exactamente al mismo sitio."))
    return [pg("page", a, LIBRO, lbl="Cómo usar el libro"), pg("page", b, LIBRO, lbl="Cómo escuchar los audios")]


# ======================================================================= pronunciación
def pronunciacion():
    a = bloque('<h3>Cómo leer la pronunciación</h3>',
               p('Todo lo que está en amarillo se lee como en español. Solo hay unas pocas reglas, y son siempre las mismas en todo el libro.'),
               sonidos([("á", "La tilde marca la sílaba fuerte. Respétala siempre: es lo que más ayuda a que te entiendan."),
                        ("ii", "Una i larga, sonriendo. <b>Sheep</b> (oveja) es «shiip»; <b>ship</b> (barco) es «ship», corta."),
                        ("j", "Suave, como un suspiro, nunca como la jota de «jamón». <b>Hello</b> es «jelóu»."),
                        ("z", "La lengua asoma entre los dientes. <b>Thank you</b> es «zánk iú». Si dices «sánk iú», también te entienden."),
                        ("sh", "Como cuando mandas callar: «shhh». <b>Sugar</b> (azúcar) es «shúgar»."),
                        ("v", "Dientes de arriba sobre el labio de abajo. <b>Very</b> es «véri», no «béri»."),
                        ("s-", "Empieza directamente con s, sin poner una e delante. <b>Spain</b> es «s-péin», no «espéin».")]))
    b = bloque('<h3>Tres consejos de oro</h3>',
               caja("1. Di siempre el final de la palabra", p('En inglés el final cambia el significado. «Can» es «puedo» y «can’t» es «no puedo». Por eso en este libro las últimas letras se escriben siempre: pronúncialas, aunque te parezca exagerado.')),
               caja("2. Cuidado con 15 y 50", p('<b>Fifteen</b> (15) es «fiftíin», con la fuerza al final. <b>Fifty</b> (50) es «fífti», con la fuerza al principio. Si dudas, di las cifras sueltas: «uán fáiv» (1 5) o enseña los dedos. Con el dinero, pide siempre que te lo escriban.')),
               caja("3. Habla despacio, no fuerte", p('Allí el inglés también es una lengua extranjera para casi todos. Las frases cortas y lentas se entienden mejor que las largas y rápidas. Una sonrisa abre más puertas que la gramática.')),
               truco("Can you write it, please?", "«Can iú ráit it, pliis?» Es la frase más útil del libro: pide que te lo escriban y lo traduces con calma en el móvil."))
    return [pg("page", a, LIBRO, lbl="Pronunciación"), pg("page", b, LIBRO, lbl="Pronunciación")]


# ======================================================================= capítulo 1
def cap1():
    run = "Capítulo 1 | Lo básico"
    a = chap_opener(1, "Lo básico que salva el día", "The basics | De béisiks", "hola",
                    ["Saludar y despedirte con educación", "Las frases que te sacan de cualquier apuro", "Los números y los precios sin confusiones"],
                    "Con lo que hay en este capítulo puedes pasar un día entero fuera de casa. Si solo te da tiempo a aprender un capítulo antes de viajar, que sea este.")
    b = bloque(sec("Saludar y despedirte", "Greetings | Gríitings"),
               frases([("Hello! / Hi!", "Jelóu! / Jái!", "¡Hola!"),
                       ("Good morning.", "Gud mórning", "Buenos días (hasta las 12)."),
                       ("Good afternoon.", "Gud afternúun", "Buenas tardes."),
                       ("Good evening.", "Gud íivning", "Buenas noches (al llegar)."),
                       ("How are you?", "Jáu ar iú?", "¿Qué tal estás?"),
                       ("I'm fine, thank you.", "Áim fáin, zánk iú", "Bien, gracias."),
                       ("Nice to meet you.", "Náis tu miit iú", "Encantada."),
                       ("Goodbye! / Bye!", "Gud-bái! / Bái!", "¡Adiós!"),
                       ("See you tomorrow.", "Sii iú tumórou", "Hasta mañana.")], legend=True))
    c = bloque(sec("Por favor, gracias y perdón", "Being polite | Biíng paláit"),
               frases([("Please.", "Pliis", "Por favor."),
                       ("Thank you very much.", "Zánk iú véri mach", "Muchas gracias."),
                       ("You're welcome.", "Iór uélkam", "De nada."),
                       ("Excuse me.", "Ekskiús mi", "Perdone (para llamar la atención o pasar)."),
                       ("Sorry!", "Sóri!", "¡Perdón! (si te equivocas o tropiezas)"),
                       ("No problem.", "Nóu próblem", "No pasa nada."),
                       ("Yes, please. / No, thank you.", "Iés, pliis / Nóu, zánk iú", "Sí, por favor. / No, gracias.")]),
               truco("", "Con «please» y «thank you» al final de cualquier frase ya suenas educada, aunque el resto lo digas a medias. Y en Asia, una sonrisa vale tanto como la frase."))
    d = bloque(sec("Las frases salvavidas", "Lifesavers | Láif-séivers"),
               p('Apréndete estas de memoria. Sirven en el mercado, en el hospital y en el aeropuerto.', 'soft'),
               frases([("I speak a little English.", "Ái s-piik a lítel ínglish", "Hablo un poco de inglés."),
                       ("I don't understand.", "Ái dóunt anderstánd", "No entiendo."),
                       ("Slowly, please.", "Slóuli, pliis", "Más despacio, por favor."),
                       ("Can you repeat, please?", "Can iú ripíit, pliis?", "¿Puede repetir, por favor?"),
                       ("Can you write it, please?", "Can iú ráit it, pliis?", "¿Me lo puede escribir?"),
                       ("How do you say this?", "Jáu du iú séi dis?", "¿Cómo se dice esto?"),
                       ("Do you speak Spanish?", "Du iú s-piik s-pánish?", "¿Habla español?"),
                       ("One moment, please.", "Uán móument, pliis", "Un momento, por favor."),
                       ("Where is the toilet?", "Uér is de tóilet?", "¿Dónde está el baño?")]))
    e1 = bloque(sec("Los números", "Numbers | Námbers"),
                vocab3([("1 one", "uán", ""), ("2 two", "tuu", ""), ("3 three", "zrii", ""), ("4 four", "for", ""), ("5 five", "fáiv", ""),
                       ("6 six", "siks", ""), ("7 seven", "séven", ""), ("8 eight", "éit", ""), ("9 nine", "náin", ""), ("10 ten", "ten", ""),
                       ("11 eleven", "iléven", ""), ("12 twelve", "tuélv", ""), ("13 thirteen", "zertíin", ""), ("14 fourteen", "fortíin", ""),
                       ("15 fifteen", "fiftíin", ""), ("20 twenty", "tuénti", ""), ("30 thirty", "zérti", ""), ("40 forty", "fórti", ""),
                       ("50 fifty", "fífti", ""), ("60 sixty", "síksti", ""), ("100 one hundred", "uán jándred", ""), ("1.000 one thousand", "uán záusand", "")]),
                truco("Ojo con -teen y -ty", "Del 13 al 19 la fuerza va al final (fiftíin). Las decenas la llevan al principio (fífti). Si te dicen un precio y dudas, pregunta: «Fifteen? One five?» y enseña los dedos.", badge="Cuidado", pink=True))
    f = bloque(sec("Precios y cantidades", "Prices | Práises", "dinero"),
               frases([("How much is it?", "Jáu mach is it?", "¿Cuánto cuesta?"),
                       ("How much for two?", "Jáu mach for tuu?", "¿Cuánto por dos?"),
                       ("Can you write the price?", "Can iú ráit de práis?", "¿Me escribe el precio?"),
                       ("It's too expensive.", "Its tuu ekspénsiv", "Es demasiado caro."),
                       ("This one, please.", "Dis uán, pliis", "Este, por favor."),
                       ("That's all, thank you.", "Dats ol, zánk iú", "Eso es todo, gracias.")], small=True),
               oiras("Así lo oirás allí", "Los precios grandes se acortan. Y a veces se comen los ceros.",
                     [("Fifty K", "50.000 (K significa mil). Muy común en Vietnam."),
                      ("One hundred", "Puede ser 100… o 100.000 dongs. Mira el billete."),
                      ("Two-fifty", "250. Se dice así, de dos en dos.")]))
    g = bloque(sec("Las horas y los días", "Time | Táim"),
               frases([("What time is it?", "Uát táim is it?", "¿Qué hora es?"),
                       ("At nine o'clock.", "At náin oklók", "A las nueve en punto."),
                       ("At seven thirty.", "At séven zérti", "A las siete y media."),
                       ("Today / Tomorrow", "Tudéi / Tumórou", "Hoy / Mañana"),
                       ("Morning / Evening", "Mórning / Íivning", "Mañana / Tarde-noche"),
                       ("Monday", "Mándei", "Lunes"),
                       ("On Friday", "On Fráidei", "El viernes")], small=True),
               truco("Las horas, como en el reloj digital", "Di la hora con los números del reloj: «seven thirty» (7:30), «ten fifteen» (10:15). Es lo más fácil y todo el mundo lo entiende."),
               p('<b>Los días:</b> Monday (mándei), Tuesday (tiúsdei), Wednesday (uénsdei), Thursday (zérsdei), Friday (fráidei), Saturday (sáturdei), Sunday (sándei).', 'soft'))
    return [pg("page", a[1], run, cls="opener", chapter=(1, "Lo básico que salva el día", "Saludar, «no entiendo», números y precios"), lbl="Capítulo 1"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run), pg("page", e1, run), pg("page", f, run), pg("page", g, run)]


# ======================================================================= capítulo 2
def cap2():
    run = "Capítulo 2 | Aeropuerto e inmigración"
    a = chap_opener(2, "Aeropuerto e inmigración", "Airport and immigration | Érport and imigréishon", "avion",
                    ["Facturar, pasar controles y encontrar tu puerta", "Responder a lo que te preguntan en el control de pasaportes", "Ir a la oficina de inmigración sin miedo"],
                    "Llevas muchas horas de vuelo, estás cansada y el policía de la ventanilla te pregunta algo muy rápido. Tranquila: siempre son las mismas cinco preguntas, y aquí las tienes.")
    b = bloque(sec("En el aeropuerto", "At the airport | At di érport"),
               frases([("I have one suitcase.", "Ái jav uán sútkeis", "Llevo una maleta."),
                       ("Where is gate twelve?", "Uér is géit tuélv?", "¿Dónde está la puerta 12?"),
                       ("Is the flight delayed?", "Is de fláit diléid?", "¿El vuelo va con retraso?"),
                       ("Where is the exit?", "Uér is di éksit?", "¿Dónde está la salida?"),
                       ("Where can I buy a SIM card?", "Uér can ái bái a sim kard?", "¿Dónde compro una tarjeta SIM?"),
                       ("My suitcase didn't arrive.", "Mái sútkeis dídent aráiv", "Mi maleta no ha llegado.")], legend=True),
               oiras("Así lo oirás allí", "En el mostrador te preguntarán poco y muy rápido.",
                     [("Window or aisle?", "¿Ventanilla o pasillo?")]))
    c = bloque(oiras("En el control de pasaportes", "Estas son las preguntas de siempre, tal como suelen sonar.",
                     [("Purpose of visit?", "¿Motivo del viaje?"), ("How long you stay?", "¿Cuánto tiempo se queda?"),
                      ("Where you stay?", "¿Dónde se aloja?"), ("Return ticket?", "¿Tiene billete de vuelta?"),
                      ("Look camera. Finger here.", "Mire a la cámara. Ponga el dedo aquí.")], "avion"),
               '<div class="legend"><span>Tus respuestas</span><span>Se dice</span></div>',
               frases([("Holiday.", "Jólidei", "De vacaciones."),
                       ("For one month.", "For uán manz", "Un mes."),
                       ("At this hotel. Here is the address.", "At dis jotél. Jíer is di adrés", "En este hotel. Aquí tiene la dirección."),
                       ("I am retired.", "Ái am ritáierd", "Estoy jubilada.")], small=True))
    d = bloque(sec("En la oficina de inmigración", "Immigration office | Imigréishon ófis"),
               vocab([("visa", "víisa", "visado"), ("extension", "eksténshon", "prórroga"), ("form", "form", "formulario"),
                      ("copy", "kópi", "fotocopia"), ("photo", "fóutou", "foto de carné"),                       ("queue number", "kiú námber", "número de turno"), ("fee", "fii", "tasa, lo que se paga"), ("overstay", "óuver-s-téi", "quedarse más días de los permitidos"),
                      ("address report", "adrés ripórt", "aviso de domicilio"), ("visa run", "víisa ran", "salir del país y volver a entrar")]),
               frases([("I want to extend my visa.", "Ái uánt tu eksténd mái víisa", "Quiero prorrogar mi visado."),
                       ("Which form do I need?", "Uích form du ái niid?", "¿Qué formulario necesito?"),
                                              ("Where do I pay?", "Uér du ái péi?", "¿Dónde pago?")], small=True))
    e2 = bloque(dialogo("Ensaya la escena", [("Funcionario", "Passport, form, photo.", "Pasaporte, formulario, foto."),
                                             ("Tú", "Here you are.", "Jíer iú ar."),
                                             ("Funcionario", "Copy this page also.", "También copia de esta página."),
                                             ("Tú", "Sorry, I don't have a copy. Where can I make one?", "Sóri, ái dóunt jav a kópi. Uér can ái méik uán?"),
                                             ("Funcionario", "Upstairs. Then come back, number 45.", "Arriba. Luego vuelva, número 45."),
                                             ("Tú", "Thank you very much!", "Zánk iú véri mach!")]),
                truco("", "Lleva fotocopias del pasaporte (foto, visado y último sello de entrada) y fotos de carné. Las piden casi siempre."),
                caja("Las normas cambian", p('Los días de estancia y los papeles cambian a menudo. Míralo siempre en la web oficial de inmigración del país, no en páginas que cobran por «tramitar». Los tres países piden un formulario de llegada por internet antes del vuelo.')))
    return [pg("page", a[1], run, cls="opener", chapter=(2, "Aeropuerto e inmigración", "Check-in, control de pasaportes, visados"), lbl="Capítulo 2"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run), pg("page", e2, run)]


# ======================================================================= capítulo 3
def cap3():
    run = "Capítulo 3 | Tu casa"
    a = chap_opener(3, "Tu casa", "Your home | Iór jóum", "casa",
                    ["Preguntar lo importante antes de alquilar", "Entender la fianza, el contrato y las facturas", "Explicar que algo se ha roto"],
                    "Has encontrado un apartamento precioso, con piscina y a diez minutos del mar. Antes de firmar, hay seis preguntas que te pueden ahorrar mucho dinero.")
    b = bloque(sec("Buscar piso", "Looking for a place | Lúking for a pléis"),
               frases([("I'm looking for an apartment for six months.", "Áim lúking for an apártment for siks manz", "Busco un apartamento para seis meses."),
                       ("How much per month?", "Jáu mach per manz?", "¿Cuánto al mes?"),
                       ("Is it furnished?", "Is it fárnisht?", "¿Está amueblado?"),
                       ("Are water and electricity included?", "Ar uóter and elektrísiti inklúuded?", "¿El agua y la luz están incluidas?"),
                       ("How much is the electricity per unit?", "Jáu mach is di elektrísiti per iúnit?", "¿A cuánto está la luz por unidad?"),
                       ("How much is the deposit?", "Jáu mach is de dipósit?", "¿De cuánto es la fianza?"),
                       ("Can I see it today?", "Can ái sii it tudéi?", "¿Puedo verlo hoy?"),
                       ("Is there a washing machine?", "Is der a uóshing mashíin?", "¿Hay lavadora?")], small=True),
)
    c = bloque(sec("El contrato y las facturas", "Contract and bills | Kóntrakt and bils"),
               vocab([("rent", "rent", "alquiler"), ("deposit", "dipósit", "fianza"), ("contract", "kóntrakt", "contrato"),
                      ("one month in advance", "uán manz in adváns", "un mes por adelantado"), ("landlord", "lánd-lord", "propietario, casero"),
                      ("building office", "bílding ófis", "oficina del edificio"), ("electricity bill", "elektrísiti bil", "factura de la luz"),
                      ("water bill", "uóter bil", "factura del agua"), ("key card", "kii kard", "tarjeta de la puerta"),
                      ("move in / move out", "muuv in / muuv áut", "entrar / dejar el piso"), ("notice", "nóutis", "preaviso"),
                      ("refund", "ríifand", "devolución")]),
               truco("Pregunta por la luz", "Muchos propietarios cobran la electricidad más cara que la compañía. Pregunta el precio por unidad (kWh) antes de firmar y pídelo por escrito."))
    c2 = bloque(sec("Antes de entrar a vivir", "Moving in | Múuving in", "casa"),
               lista(["Haz fotos y un vídeo de todo el piso el primer día y mándaselos al propietario.",
                      "Pregunta cuándo te devuelven la fianza y que conste en el contrato.",
                      "En Tailandia y en Vietnam, el propietario debe registrar tu dirección. Pregúntale si lo ha hecho."]),
               frases([("Can you register my address, please?", "Can iú rédyister mái adrés, pliis?", "¿Puede registrar mi dirección?"),
                       ("When do I get my deposit back?", "Uén du ái guet mái dipósit bak?", "¿Cuándo me devuelven la fianza?"),
                       ("Can you write it in the contract?", "Can iú ráit it in de kóntrakt?", "¿Puede ponerlo en el contrato?")], small=True),
               truco("Por escrito, mejor", "Habla con el propietario por mensajes: LINE en Tailandia, Zalo en Vietnam, Messenger o WhatsApp en Filipinas. Así queda constancia y puedes traducir con calma."))
    d = bloque(sec("Algo se ha roto", "Something is broken | Sámzing is bróuken"),
               frases([("The air conditioner is broken.", "Di ér kondíshoner is bróuken", "El aire acondicionado no funciona."),
                       ("There is no hot water.", "Der is nóu jot uóter", "No hay agua caliente."),
                       ("There is a leak.", "Der is a líik", "Hay una gotera o una fuga."),
                       ("The power is off.", "De páuer is of", "Se ha ido la luz."),
                       ("The toilet is blocked.", "De tóilet is blokt", "El váter está atascado."),
                       ("Can you send someone?", "Can iú send sámuan?", "¿Puede mandar a alguien?"),
                       ("When can you fix it?", "Uén can iú fiks it?", "¿Cuándo lo puede arreglar?")], small=True),
               oiras("Así lo oirás allí", "Las respuestas suelen ser cortas. Pide siempre un día y una hora.",
                     [("Tomorrow technician come.", "Mañana viene el técnico."), ("Up to you.", "Como usted quiera.")]),
)
    return [pg("page", a[1], run, cls="opener", chapter=(3, "Tu casa: alquilar un piso", "Fianza, contrato, facturas, averías"), lbl="Capítulo 3"),
            pg("page", b, run), pg("page", c, run), pg("page", c2, run), pg("page", d, run)]


# ======================================================================= capítulo 4
def cap4():
    run = "Capítulo 4 | Dinero"
    a = chap_opener(4, "Dinero", "Money | Máni", "dinero",
                    ["Sacar dinero sin pagar comisiones de más", "Pagar, pedir el cambio y no confundir billetes", "Regatear en el mercado con una sonrisa"],
                    "El cajero te habla en inglés, la pantalla te ofrece cosas raras y detrás hay cola. Respira: solo hay un botón que de verdad importa, y está en la página siguiente.")
    b = bloque(sec("En el cajero", "At the ATM | At di ei-ti-ém"),
               vocab([("ATM", "ei-ti-ém", "cajero automático"), ("withdraw", "uizdró", "sacar dinero"), ("insert card", "insért kard", "introduzca la tarjeta"),
                      ("enter PIN", "énter pin", "teclee el PIN"), ("fee", "fii", "comisión"), ("cancel", "kánsel", "cancelar")]),
               truco("Without conversion", "Cuando la pantalla te ofrezca cobrar en euros (o en tu moneda), elige siempre la moneda del país: «without conversion», sin conversión. Si aceptas la conversión, te cambian a un precio peor y pagas más en cada retirada.", badge="Importante", pink=True),
               frases([("The ATM took my card.", "Di ei-ti-ém tuk mái kard", "El cajero se ha tragado mi tarjeta."),
                       ("Where is the nearest ATM?", "Uér is de níerest ei-ti-ém?", "¿Dónde está el cajero más cercano?")], small=True))
    c = bloque(sec("Pagar", "Paying | Péing"),
               frases([("Can I pay by card?", "Can ái péi bái kard?", "¿Puedo pagar con tarjeta?"),
                       ("Do you have change?", "Du iú jav chéindy?", "¿Tiene cambio?"),
                       ("I don't have small notes.", "Ái dóunt jav s-mol nóuts", "No tengo billetes pequeños."),
                       ("Can I have a receipt?", "Can ái jav a risíit?", "¿Me da un recibo?"),
                       ("Is it fifty thousand or five hundred thousand?", "Is it fífti záusand or fáiv jándred záusand?", "¿Son 50.000 o 500.000?")], small=True),
               oiras("Así lo oirás allí", "", [("Cash only.", "Solo efectivo."), ("Machine no work.", "La máquina no funciona."), ("No change.", "No tengo cambio.")]),
               caja("Billetes que se parecen", p('En Vietnam los billetes de 20.000 y de 500.000 dongs son del mismo color: guarda los grandes aparte.')))
    d = bloque(sec("En el mercado", "At the market | At de márket", "comida"),
               frases([("How much is this?", "Jáu mach is dis?", "¿Cuánto cuesta esto?"),
                       ("Can you give me a discount?", "Can iú guiv mi a dískaunt?", "¿Me hace un descuento?"),
                       ("Last price?", "Last práis?", "¿Último precio?"),
                       ("OK, I take it.", "Okéi, ái téik it", "Vale, me lo llevo."),
                       ("Maybe later, thank you.", "Méibi léiter, zánk iú", "Quizá luego, gracias.")], small=True),
               oiras("Así lo oirás allí", "", [("Same same but different.", "Parecido, pero no igual. Típico de las copias.")]),
               truco("Regatea sonriendo", "En los mercados turísticos el primer precio puede ser el doble o más. Ofrece la mitad y sube poco a poco, sin enfadarte. Si no hay acuerdo, da las gracias y aléjate. Donde hay precio marcado, no se regatea."))
    return [pg("page", a[1], run, cls="opener", chapter=(4, "Dinero", "Cajero, pagar y regatear"), lbl="Capítulo 4"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run)]


# ======================================================================= capítulo 5
def cap5():
    run = "Capítulo 5 | Salud"
    a = chap_opener(5, "En el hospital y la farmacia", "Health | Jelz", "clinica",
                    ["Explicar lo que te pasa y dónde te duele", "Entender al médico y cómo tomar la medicación", "Hablar con el seguro y saber qué hacer en una urgencia"],
                    "Es el capítulo que más miedo da y el que más te va a servir. Los hospitales privados suelen atender en inglés, pero con mascarilla, prisa y acento. Aquí tienes justo lo que necesitas.")
    b = bloque(sec("Explicar lo que te pasa", "At the doctor | At de dóktor", "clinica"),
               frases([("It hurts here.", "It jerts jíer", "Me duele aquí."),
                       ("I have a fever.", "Ái jav a fíiver", "Tengo fiebre."),
                       ("I feel dizzy.", "Ái fiil dísi", "Estoy mareada."),
                       ("Since yesterday.", "Sins iésterdei", "Desde ayer."),
                       ("For three days.", "For zrii déis", "Desde hace tres días."),
                       ("I have travel insurance.", "Ái jav trável inshúrans", "Tengo seguro de viaje."),
                       ("I am allergic to penicillin.", "Ái am alérdyik tu penisílin", "Soy alérgica a la penicilina."),
                       ("I take medicine for blood pressure.", "Ái téik médisin for blad préshur", "Tomo pastillas para la tensión."),
                       ("Is there a doctor who speaks Spanish?", "Is der a dóktor ju s-piiks s-pánish?", "¿Hay algún médico que hable español?")], small=True))
    c = bloque(oiras("Así lo oirás allí", "En Asia el inglés se habla corto y directo. No es el de los cursos, pero se entiende igual.",
                     [("Where pain?", "¿Dónde le duele?"), ("Pain how long?", "¿Desde cuándo?"), ("Take after eat.", "Tómelo después de comer."), ("Two time one day.", "Dos veces al día.")], "doctora"),
               dialogo("Ensaya la escena", [("Doctora", "Where pain?"), ("Tú", "Here. My ankle.", "Jíer. Mái ánkel."),
                                            ("Doctora", "Take after eat. Two time one day."), ("Tú", "After food, two times a day.", "Áfter fud, tuu táims a déi.")]),
               truco("Can you write it down, please?", "«Can iú ráit it dáun, pliis?» Pide que te escriban la dosis y el nombre de la medicina. Luego lo traduces en el móvil con calma."))
    d = bloque(sec("El seguro médico", "Insurance | Inshúrans"),
               vocab([("guarantee of payment", "garantíi ov péiment", "garantía de pago del seguro"), ("direct billing", "dairékt bíling", "el seguro paga directamente"),
                      ("deposit", "dipósit", "depósito, adelanto"), ("discharge", "dischárdy", "dar el alta")]),
               frases([("Do you have direct billing with my insurance?", "Du iú jav dairékt bíling uíz mái inshúrans?", "¿Trabajan directamente con mi seguro?"),
                       ("Please call my insurance.", "Pliis kol mái inshúrans", "Llamen a mi seguro, por favor."),
                       ("Can I have the medical report and the receipt?", "Can ái jav de médikal ripórt and de risíit?", "¿Me dan el informe y el recibo?")], small=True),
               truco("Antes de que te ingresen", "Pide que llamen a tu seguro y espera la «guarantee of payment». Sin ella pueden pedirte un depósito grande. Guarda el informe y el recibo.", badge="Importante", pink=True))
    f = bloque(sec("En la farmacia", "At the pharmacy | At de fármasi", "farmacia"),
               frases([("I need something for a cough.", "Ái niid sámzing for a kof", "Necesito algo para la tos."),
                       ("I have a cold.", "Ái jav a kóuld", "Estoy constipada."),
                       ("I have diarrhea.", "Ái jav daiaría", "Tengo diarrea."),
                       ("I have a headache.", "Ái jav a jédeik", "Me duele la cabeza."),
                       ("Something for mosquito bites.", "Sámzing for moskíitou báits", "Algo para las picaduras de mosquito."),
                       ("How many times a day?", "Jáu méni táims a déi?", "¿Cuántas veces al día?"),
                       ("Before or after food?", "Bifór or áfter fud?", "¿Antes o después de comer?")], small=True),
               truco("Ojo, falsos amigos", "«Constipated» no es constipada: significa estreñida. Si tienes un resfriado di «I have a cold». Y «embarrassed» es avergonzada; embarazada es «pregnant».", badge="Cuidado", pink=True))
    g = bloque(sec("Las partes del cuerpo", "The body | De bódi"),
               vocab([("head", "jed", "cabeza"), ("eye", "ái", "ojo"), ("ear", "íer", "oído, oreja"), ("throat", "zróut", "garganta"),
                      ("chest", "chest", "pecho"), ("back", "bak", "espalda"), ("stomach", "s-tómak", "estómago, tripa"),
                      ("hand", "jand", "mano"), ("leg", "leg", "pierna"), ("knee", "nii", "rodilla"),
                      ("foot", "fut", "pie"), ("ankle", "ánkel", "tobillo")]),
               frases([("I am diabetic.", "Ái am daiabétik", "Soy diabética."),
                       ("I have a heart condition.", "Ái jav a jart kondíshon", "Tengo un problema de corazón.")], small=True))
    h = bloque(sec("Urgencias", "Emergency | Emérdyensi"),
               frases([("Help!", "Jelp!", "¡Socorro!"),
                       ("Call an ambulance!", "Kol an ámbiulans!", "¡Llamen a una ambulancia!"),
                       ("It's an emergency.", "Its an emérdyensi", "Es una urgencia."),
                       ("I can't breathe.", "Ái kant briid", "No puedo respirar."),
                       ("Take me to the hospital, please.", "Téik mi tu de jóspital, pliis", "Lléveme al hospital, por favor.")], small=True),
               caja("Teléfonos de emergencia", datos([("Tailandia: ambulancia", "1669"), ("Tailandia: policía turística (en inglés)", "1155"),
                                                      ("Vietnam: ambulancia", "115"), ("Vietnam: policía", "113"), ("Filipinas: todas las emergencias", "911")])),
               p('Guarda también el teléfono de urgencias de tu hospital privado: suelen atender en inglés.', 'soft'))
    return [pg("page", a[1], run, cls="opener", chapter=(5, "En el hospital y la farmacia", "Síntomas, seguro, medicinas, urgencias"), lbl="Capítulo 5"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run), pg("page", f, run), pg("page", g, run), pg("page", h, run)]


# ======================================================================= capítulo 6
def cap6():
    run = "Capítulo 6 | Moverte"
    a = chap_opener(6, "Moverte", "Getting around | Gueting aráund", "tuktuk",
                    ["Pedir un coche con una app y escribir al conductor", "Tomar un taxi o una moto sin sorpresas en el precio", "Pedir y entender direcciones"],
                    "Las aplicaciones de transporte son tu mejor amiga: ves el precio antes de subir y no tienes que explicar adónde vas. Solo te falta saber qué escribirle al conductor.")
    b = bloque(sec("Con Grab y otras apps", "Ride apps | Ráid aps", "movil"),
               p('Para mensajes al conductor. Cópialos tal cual en el chat de la aplicación.', 'soft'),
               frases([("I'm here.", "Áim jíer", "Ya estoy aquí."),
                       ("I'm at the main gate.", "Áim at de méin géit", "Estoy en la puerta principal."),
                       ("I'm wearing a red shirt.", "Áim uéring a red shert", "Llevo una camisa roja."),
                       ("Please wait two minutes.", "Pliis uéit tuu mínits", "Espere dos minutos, por favor."),
                       ("Where are you?", "Uér ar iú?", "¿Dónde está usted?"),
                       ("I'm coming.", "Áim káming", "Ya voy.")], small=True),
               truco("Mejor escribir que hablar", "Si el conductor te llama y no le entiendes, no contestes: escríbele en el chat. Muchas aplicaciones traducen solas los mensajes cortos. Y fíjate en la matrícula antes de subir."))
    c = bloque(sec("Taxi y moto", "Taxi and motorbike | Táksi and móutorbaik"),
               frases([("Meter, please.", "Míiter, pliis", "Con taxímetro, por favor."),
                       ("How much to the airport?", "Jáu mach tu di érport?", "¿Cuánto hasta el aeropuerto?"),
                       ("Please take me to this address.", "Pliis téik mi tu dis adrés", "Lléveme a esta dirección."),
                       ("Stop here, please.", "S-top jíer, pliis", "Pare aquí, por favor."),
                       ("Do you have a helmet?", "Du iú jav a jélmet?", "¿Tiene casco?")], small=True),
               oiras("Así lo oirás allí", "", [("No meter. Three hundred.", "Sin taxímetro: 300, precio cerrado. Si te parece caro, busca otro."),
                                                ("You go where?", "¿Adónde va?"),
                                                ("Special trip?", "(Filipinas) ¿El vehículo entero para usted? Cuesta más.")]),
               truco("", "Acuerda el precio antes de subir a una moto o a un tuk-tuk."))
    d = bloque(sec("Direcciones", "Directions | Dairékshons"),
               vocab([("left", "left", "izquierda"), ("right", "ráit", "derecha"), ("straight on", "s-tréit on", "todo recto"),
                      ("near / far", "níer / far", "cerca / lejos"),
                      ("opposite", "óposit", "enfrente"), ("traffic lights", "tráfik láits", "semáforo")]),
               frases([("Where is the market?", "Uér is de márket?", "¿Dónde está el mercado?"),
                       ("Can I walk?", "Can ái uók?", "¿Se puede ir andando?"),
                       ("Can you show me on the map?", "Can iú shóu mi on de map?", "¿Me lo enseña en el mapa?")], small=True),
               truco("Tu dirección, en el idioma del país", "Muchos conductores no leen inglés. Lleva tu dirección escrita en el idioma del país: tienes una tarjeta al final del libro."))
    return [pg("page", a[1], run, cls="opener", chapter=(6, "Moverte", "Grab, taxi, moto y direcciones"), lbl="Capítulo 6"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run)]


# ======================================================================= capítulo 7
def cap7():
    run = "Capítulo 7 | Comer y comprar"
    a = chap_opener(7, "Comer y comprar", "Food and shopping | Fud and shóping", "comida",
                    ["Pedir en un restaurante a tu gusto: sin picante y con poco azúcar", "Explicar una alergia sin riesgos", "Comprar en el súper, en el 7-Eleven y llevar la ropa a lavar"],
                    "La comida es uno de los grandes placeres de Asia. Picante, dulce, con cacahuete escondido… Con las frases de este capítulo comes lo que quieres y como lo quieres.")
    b = bloque(sec("En el restaurante", "At the restaurant | At de réstorant", "comida"),
               frases([("A table for one, please.", "A téibel for uán, pliis", "Una mesa para una persona."),
                       ("The menu, please.", "De ményu, pliis", "La carta, por favor."),
                       ("Not spicy, please.", "Not s-páisi, pliis", "Sin picante, por favor."),
                       ("A little spicy.", "A lítel s-páisi", "Un poco picante."),
                       ("Less sugar, please.", "Les shúgar, pliis", "Con poco azúcar, por favor."),
                       ("No ice, please.", "Nóu áis, pliis", "Sin hielo, por favor."),
                       ("The bill, please.", "De bil, pliis", "La cuenta, por favor.")], small=True),
               oiras("Así lo oirás allí", "", [("Check bin?", "¿Le traigo la cuenta? (check bill)"), ("Eat here or take away?", "¿Para tomar aquí o para llevar?"),
                                                ("Spicy can?", "¿Puede comer picante?")]))
    c = bloque(sec("Alergias y dietas", "Allergies | Álerdyis"),
               frases([("I'm allergic to peanuts.", "Áim alérdyik tu píinats", "Soy alérgica al cacahuete."),
                       ("I'm allergic to seafood.", "Áim alérdyik tu síifud", "Soy alérgica al marisco."),
                       ("Is there peanut in this?", "Is der píinat in dis?", "¿Esto lleva cacahuete?"),
                       ("I don't eat meat.", "Ái dóunt iit míit", "No como carne."),
                       ("No MSG, please.", "Nóu em-es-dyíi, pliis", "Sin glutamato, por favor.")], small=True),
               truco("Lleva tu alergia escrita", "El cacahuete aparece en salsas, ensaladas y aceites, y no siempre se ve. Si tienes una alergia seria, enseña la tarjeta de alergias del final del libro escrita en el idioma del país, y vuelve a preguntar al servir el plato.", badge="Importante", pink=True))
    d = bloque(sec("Súper, 7-Eleven y lavandería", "Shops and laundry | Shops and lóndri"),
               oiras("Así lo oirás allí", "En las tiendas 24 horas siempre te preguntan lo mismo.",
                     [("Bag?", "¿Quiere bolsa?"), ("Heat up?", "¿Se lo caliento?"), ("Anything else?", "¿Algo más?")]),
               frases([("Yes, heat it up, please.", "Iés, jiit it ap, pliis", "Sí, caliéntemelo, por favor."),
                       ("No bag, thank you.", "Nóu bag, zánk iú", "Sin bolsa, gracias."),
                       ("Where can I find rice?", "Uér can ái fáind ráis?", "¿Dónde está el arroz?"),
                       ("How much per kilo?", "Jáu mach per kíilou?", "¿Cuánto el kilo? (también en la lavandería)"),
                       ("When is it ready?", "Uén is it rédi?", "¿Cuándo estará listo?"),
                       ("Please don't dry this one.", "Pliis dóunt drái dis uán", "Esta prenda, sin secadora.")], small=True))
    return [pg("page", a[1], run, cls="opener", chapter=(7, "Comer y comprar", "Restaurante, alergias, súper, lavandería"), lbl="Capítulo 7"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run)]


# ======================================================================= capítulo 8
def cap8():
    run = "Capítulo 8 | Sola y segura"
    a = chap_opener(8, "Sola y segura", "Safe and sound | Séif and sáund", "segura",
                    ["Pedir ayuda cuando la necesitas", "Decir que no con firmeza y sin miedo", "Reconocer los engaños más típicos y qué hacer si te pasa algo"],
                    "El Sudeste Asiático es, en general, un sitio seguro y amable. Pero sabes cuidarte, y en este capítulo tienes las palabras para hacerlo también en inglés.")
    b = bloque(sec("Pedir ayuda", "Asking for help | Ásking for jelp"),
               frases([("Can you help me, please?", "Can iú jelp mi, pliis?", "¿Me puede ayudar, por favor?"),
                       ("I'm lost.", "Áim lost", "Me he perdido."),
                       ("I lost my passport.", "Ái lost mái pásport", "He perdido el pasaporte."),
                       ("Call the police!", "Kol de polís!", "¡Llamen a la policía!")], small=True),
               sec("Decir que no", "Saying no | Séing nóu"),
               frases([("No, thank you.", "Nóu, zánk iú", "No, gracias."),
                       ("I'm not interested.", "Áim not ínterested", "No me interesa."),
                       ("Please leave me alone.", "Pliis liiv mi alóun", "Déjeme en paz, por favor."),
                       ], small=True),
               truco("Firme y tranquila", "Di que no con voz tranquila y sin dar explicaciones. En Asia, levantar la voz empeora las cosas: la calma es tu mejor arma."))
    c = bloque(sec("Los engaños más típicos", "Common scams | Kómon s-kams"),
               lista(["<b>«The temple is closed today».</b> Alguien amable te dice que el templo está cerrado y te ofrece un tuk-tuk barato… que acaba en una tienda de joyas. Comprueba tú misma la entrada.",
                      "<b>El taxi sin taxímetro.</b> Precio inventado al llegar. Usa apps de transporte o acuerda el precio antes.",
                      "<b>El limpiabotas o el vendedor de fruta</b> que te coge el zapato o te pone el cesto al hombro para la foto, y luego te cobra mucho.",
                      "<b>Llamadas de «la policía»</b> que te piden mover tu dinero a una «cuenta segura». La policía nunca pide transferencias por teléfono. Cuelga.",
                      "<b>Inversiones y amores por internet</b> con promesas de dinero fácil. Si suena demasiado bueno, no es verdad."]),
               frases([("I'll check myself, thank you.", "Áil chek maisélf, zánk iú", "Ya lo compruebo yo, gracias."),
                       ("I don't pay before.", "Ái dóunt péi bifór", "No pago por adelantado.")], small=True))
    d = bloque(sec("Si te pasa algo", "If something happens | If sámzing jápens"),
               frases([("Someone stole my bag.", "Sámuan s-tóul mái bag", "Alguien me ha robado el bolso."),
                       ("I want to make a police report.", "Ái uánt tu méik a polís ripórt", "Quiero poner una denuncia."),
                       ("I need a copy for my insurance.", "Ái niid a kópi for mái inshúrans", "Necesito una copia para mi seguro."),
                       ("I need to call my embassy.", "Ái niid tu kol mái émbasi", "Necesito llamar a mi embajada.")], small=True),
               caja("Antes de que pase nada", checklist([("Foto del pasaporte y del visado en el móvil y en tu correo", "Si lo pierdes, todo irá más rápido."),
                                                         ("El teléfono de la embajada o el consulado de tu país", "Apúntalo también en papel."),
                                                         ("La policía turística del país", "En Tailandia, el 1155 atiende en inglés."),
                                                         ("Alguien que sepa dónde vives", "Una vecina o un familiar.")])))
    return [pg("page", a[1], run, cls="opener", chapter=(8, "Sola y segura", "Pedir ayuda, decir que no, engaños"), lbl="Capítulo 8"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run)]


# ======================================================================= capítulo 9
def cap9():
    run = "Capítulo 9 | Hacer amigos"
    a = chap_opener(9, "Hacer amigos", "Making friends | Méiking frends", "amigos",
                    ["Presentarte y hablar de ti", "Preguntar a los demás y seguir la conversación", "Quedar para un café y pedir el contacto"],
                    "La soledad es lo que más preocupa a quien se va sola. Y la mejor forma de combatirla es hablar: con otros extranjeros, en la clase de yoga, en el café de abajo.")
    b = bloque(sec("Presentarte", "About you | Abáut iú"),
               frases([("My name is Carmen.", "Mái néim is Carmen", "Me llamo Carmen."),
                       ("I'm from Spain.", "Áim from s-péin", "Soy de España."),
                       ("I'm sixty-four.", "Áim síksti-for", "Tengo 64 años."),
                       ("I'm retired.", "Áim ritáierd", "Estoy jubilada."),
                       ("I live here for six months.", "Ái liv jíer for siks manz", "Vivo aquí seis meses."),
                       ("I have two children and three grandchildren.", "Ái jav tuu chíldren and zrii gránchildren", "Tengo dos hijos y tres nietos."),
                       ("This is my first time in Asia.", "Dis is mái ferst táim in éisha", "Es mi primera vez en Asia.")], small=True),
               truco("No traduzcas palabra por palabra", "«I have 64 years» suena raro: la edad se dice con «I'm». Igual el hambre y el frío: «I'm hungry» (áim jángri), «I'm cold» (áim kóuld).", badge="Cuidado", pink=True))
    c = bloque(sec("Charlar", "Small talk | S-mol tok"),
               frases([("Where are you from?", "Uér ar iú from?", "¿De dónde eres?"),
                       ("How long have you been here?", "Jáu long jav iú biin jíer?", "¿Cuánto tiempo llevas aquí?"),
                       ("Do you like it here?", "Du iú láik it jíer?", "¿Te gusta vivir aquí?"),
                       ("Me too!", "Mi tuu!", "¡Yo también!"),
                       ("That's great!", "Dats gréit!", "¡Qué bien!")], small=True),
               oiras("Así lo oirás allí", "Las preguntas que te harán otros extranjeros, en un inglés más rápido.",
                     [("Whereabouts in Spain?", "¿De qué parte de España?"), ("Are you here on your own?", "¿Estás aquí sola?")]),
               truco("", "Con desconocidos, no cuentes que vives sola ni dónde. Di «I'm here with friends» (áim jíer uíz frends)."))
    d = bloque(sec("Quedar", "Meeting up | Míiting ap", "amigos"),
               frases([("Would you like a coffee?", "Uúd iú láik a kófi?", "¿Te apetece un café?"),
                       ("Are you free tomorrow?", "Ar iú frii tumórou?", "¿Estás libre mañana?"),
                       ("Let's meet at the café.", "Lets miit at de kaféi", "Quedamos en la cafetería."),
                       ("Can I have your number?", "Can ái jav iór námber?", "¿Me das tu número?"),
                       ("See you there!", "Sii iú der!", "¡Nos vemos allí!")], small=True),
               caja("Cada país, su aplicación", datos([("Tailandia", "LINE"), ("Vietnam", "Zalo"), ("Filipinas", "Messenger"), ("Con otros extranjeros", "WhatsApp")])),
               truco("Dónde conocer gente", "Grupos de españoles en Facebook, clases de yoga o de cocina, intercambios de idiomas y voluntariados."))
    return [pg("page", a[1], run, cls="opener", chapter=(9, "Hacer amigos", "Presentarte, charlar, quedar"), lbl="Capítulo 9"),
            pg("page", b, run), pg("page", c, run), pg("page", d, run)]


# ======================================================================= capítulo 10
def cap10():
    run = "Capítulo 10 | Tu inglés y tu móvil"
    a = chap_opener(10, "Tu inglés y tu móvil", "Your phone | Iór fóun", "movil",
                    ["Usar el traductor para que te entiendan de verdad", "Saber cuándo el traductor no basta", "Las aplicaciones que te harán la vida fácil"],
                    "El móvil es un gran aliado. Pero en una urgencia, sin batería o con prisa, lo que llevas en la cabeza es lo que te salva. Lo mejor es usar las dos cosas a la vez.")
    b = bloque(sec("El traductor, bien usado", "Translator | Transléitor", "movil"),
               lista(["<b>Frases cortas y sencillas.</b> «Me duele la rodilla desde ayer» se traduce bien. Una frase larga con refranes, no.",
                      "<b>Enseña la pantalla</b> en lugar de leer la traducción en voz alta.",
                      "<b>Modo cámara</b> para menús, carteles y prospectos: apuntas y lo lees en español.",
                      "<b>Modo conversación</b>: cada uno habla en su idioma y el móvil traduce.",
                      "<b>Descarga los idiomas</b> (inglés, tailandés, vietnamita) para usarlos sin internet.",
                      "<b>Comprueba al revés.</b> Traduce la respuesta al español: si no tiene sentido, simplifica tu frase."]),
               frases([("Can you speak into my phone?", "Can iú s-piik íntu mái fóun?", "¿Puede hablarle a mi móvil?"),
                       ("Can you type it here?", "Can iú táip it jíer?", "¿Me lo escribe aquí?")], small=True))
    c = bloque(sec("Cuando el traductor no basta", "Without the phone | Uizáut de fóun"),
               p('Hay momentos en los que no da tiempo a sacar el móvil, o no hay batería ni cobertura. Para esos momentos están tus frases y tus tarjetas.'),
               checklist([("Una urgencia médica", "Capítulo 5 y tarjeta médica."), ("Una llamada de teléfono", "Pide que te escriban: «Can you send me a message?»"),
                          ("Una ventanilla con cola y prisa", "Lleva preparadas por escrito tus preguntas."), ("Un sitio con mucho ruido", "Enseña la frase escrita en el libro.")]),
               caja("Aplicaciones útiles", datos([("Para moverte", "Grab, Bolt, Xanh SM"), ("Para orientarte", "Google Maps"), ("Para traducir", "Google Traductor"),
                                                 ("Para hablar", "LINE, Zalo, Messenger"), ("Para pagar (Filipinas)", "GCash")])),
               frases([("Can you send me a message?", "Can iú send mi a mésedy?", "¿Me puede mandar un mensaje?")], small=True))
    return [pg("page", a[1], run, cls="opener", chapter=(10, "Tu inglés y tu móvil", "Cuándo el traductor no basta"), lbl="Capítulo 10"),
            pg("page", b, run), pg("page", c, run)]


# ======================================================================= países
def paises():
    run = "Cada país, a su manera"
    t = bloque(sec("Tailandia", "Unas palabras en tailandés abren muchas sonrisas", "pagoda"),
               p('Como mujer, termina las frases con <b>«ka»</b>; es la forma educada. Los hombres dicen <b>«krap»</b>.', 'soft'),
               locales([("Sawasdee ka", "sauat-DII ká", "Hola y adiós"), ("Khop khun ka", "kop-KUN ká", "Gracias"),
                        ("Mai pen rai", "mai-pen-RAI", "No pasa nada, de nada"), ("Tao rai?", "tao-RÁI", "¿Cuánto cuesta?"),
                        ("Mai pet", "mai PET", "Sin picante"), ("Mai ao", "mai ÁO", "No lo quiero"),
                        ]),
               oiras("El inglés de Tailandia", "", [("Same same", "Parecido, más o menos igual."), ("No have", "No hay, no tenemos."),
                                                  ("Up to you", "Como quieras.")]))
    v = bloque(sec("Vietnam", "Unas palabras en vietnamita", "farolillos"),
               p('La «kh» suena como nuestra jota y la «nh» como la eñe. Si no te entienden, sonríe y señala.', 'soft'),
               locales([("Xin chào", "sin CHÀO", "Hola"), ("Cảm ơn", "cam ÚN", "Gracias"), ("Xin lỗi", "sin LÓI", "Perdón, disculpe"),
                        ("Bao nhiêu?", "bao ÑIU", "¿Cuánto cuesta?"), ("Không cay", "jom KAI", "Sin picante"),
                        ("Tính tiền", "tin TIEN", "La cuenta")]),
               oiras("El inglés de Vietnam", "", [("Fifty K", "50.000 dongs."), ("Have / No have", "Hay / No hay."),
                                                ("Yes, yes", "Te he oído (no siempre es un sí).")]))
    f = bloque(sec("Filipinas", "Aquí casi todo el mundo habla inglés", "isla"),
               p('Muchas palabras vienen del español: <b>kumusta</b> (¿cómo estás?), y las horas se dicen en español: <b>alas dos</b> son las dos.', 'soft'),
               locales([("Salamat po", "sa-LÁ-mat po", "Gracias (educado)"), ("Magkano?", "mag-KÁ-no", "¿Cuánto cuesta?"),
                        ("Para po", "PÁ-ra po", "Pare aquí (en el jeepney)"), ("Bayad po", "BÁ-iad po", "Aquí va mi billete"),
                        ]),
               oiras("El inglés de Filipinas", "", [("CR", "El baño («comfort room»)."), ("For a while", "Espere un momento."),
                                                  ("Brownout", "Corte de luz."), ("High blood", "Enfadado (no es la tensión)."),
                                                  ("Ma'am", "Señora. Te lo dirán todo el rato.")]))
    return [pg("page", t, run, chapter=("·", "Cada país, a su manera", "Palabras locales y el inglés de cada sitio"), lbl="Tailandia"),
            pg("page", v, run, lbl="Vietnam"), pg("page", f, run, lbl="Filipinas")]


# ======================================================================= tarjetas
def tarjetas():
    run = "Tarjetas para recortar"
    def campo(en, es):
        return f'<div class="field"><span class="lab">{e(en)}<small>{e(es)}</small></span><span class="line"></span></div>'
    medica = ('<div class="cut"><div class="hd"><strong>MEDICAL CARD</strong><span>Please read<br>Por favor, lea</span></div>'
              + campo("My name is", "Me llamo") + campo("Date of birth", "Fecha de nacimiento (escribe el mes en letras)")
              + campo("I am allergic to", "Soy alérgica a") + campo("I take this medicine", "Tomo esta medicación (nombre genérico)")
              + campo("My insurance and policy number", "Mi seguro y número de póliza") + campo("Emergency contact", "Contacto de emergencia")
              + '<div class="ask"><div>Please call my insurance.<small>Por favor, llamen a mi seguro.</small></div></div></div>')
    a = bloque(sec("Tu tarjeta médica", "Recórtala, rellénala y llévala siempre en la cartera"), medica)
    casa = ('<div class="cut"><div class="hd jade"><strong>MY ADDRESS</strong><span>Please take me here<br>Lléveme aquí</span></div>'
            + campo("Address in English", "Dirección en inglés") + campo("Address in Thai / Vietnamese", "Pide que te la escriban en el idioma del país")
            + campo("Near", "Cerca de (un sitio conocido)") + campo("Phone", "Teléfono") + '</div>')
    aler = ('<div class="cut"><div class="hd"><strong>FOOD ALLERGY</strong><span>Very important<br>Muy importante</span></div>'
            + campo("I am allergic to", "Soy alérgica a") + campo("In the local language", "Pide que te lo escriban en el idioma del país")
            + '<div class="ask"><div>Is there any in this food?<small>¿Lleva esto la comida?</small></div></div></div>')
    b = bloque(casa, aler)
    return [pg("page", a, run, chapter=("·", "Tarjetas para recortar", "Médica, dirección y alergias"), lbl="Tarjetas"), pg("page", b, run, lbl="Tarjetas")]


# ======================================================================= diccionario
DICC = [
    ("A", [("address", "adrés", "dirección"), ("airport", "érport", "aeropuerto"), ("allergy", "álerdyi", "alergia"), ("ambulance", "ámbiulans", "ambulancia"), ("ATM", "ei-ti-ém", "cajero")]),
    ("B", [("bag", "bag", "bolso, bolsa"), ("bill", "bil", "cuenta, factura"), ("broken", "bróuken", "roto, estropeado")]),
    ("C", [("cash", "kash", "efectivo"), ("change", "chéindy", "cambio"), ("contract", "kóntrakt", "contrato")]),
    ("D", [("deposit", "dipósit", "fianza, depósito"), ("doctor", "dóktor", "médico"), ("doesn't work", "dásent uérk", "no funciona")]),
    ("E", [("emergency", "emérdyensi", "urgencia"), ("exit", "éksit", "salida"), ("expensive", "ekspénsiv", "caro")]),
    ("F", [("fee", "fii", "comisión, tasa"), ("fever", "fíiver", "fiebre"), ("form", "form", "formulario"), ("free", "frii", "gratis, libre")]),
    ("H", [("help", "jelp", "ayuda"), ("hospital", "jóspital", "hospital")]),
    ("I", [("included", "inklúuded", "incluido"), ("insurance", "inshúrans", "seguro")]),
    ("L", [("landlord", "lánd-lord", "propietario"), ("leak", "líik", "fuga, gotera")]),
    ("M", [("medicine", "médisin", "medicina"), ("menu", "ményu", "carta"), ("money", "máni", "dinero")]),
    ("O", [("open", "óupen", "abierto")]),
    ("P", [("pain", "péin", "dolor"), ("passport", "pásport", "pasaporte"), ("pharmacy", "fármasi", "farmacia"), ("police", "polís", "policía"), ("price", "práis", "precio")]),
    ("R", [("receipt", "risíit", "recibo"), ("rent", "rent", "alquiler")]),
    ("S", [("small", "s-mol", "pequeño"), ("spicy", "s-páisi", "picante"), ("stop", "s-top", "pare"), ("sugar", "shúgar", "azúcar")]),
    ("T", [("ticket", "tíket", "billete, entrada"), ("toilet", "tóilet", "baño")]),
    ("W", [("wait", "uéit", "esperar"), ("water", "uóter", "agua"), ("where", "uér", "dónde"), ("wrong", "rong", "equivocado")]),
]


def diccionario():
    run = "Diccionario de supervivencia"
    def bloque_dicc(letras):
        out = []
        for L, items in letras:
            out.append(f'<div class="letter-h">{L}</div>')
            out += [f"<div><b>{e(a)}</b><i>{e(b)}</i><span>{e(c)}</span></div>" for a, b, c in items]
        return '<div class="dict">' + "".join(out) + "</div>"
    mitad = 7
    a = bloque('<h3>Diccionario de supervivencia</h3>', p('Las palabras clave, de la A a la Z.', 'soft'), bloque_dicc(DICC[:mitad]))
    b = bloque(bloque_dicc(DICC[mitad:]))
    return [pg("page", a, run, chapter=("·", "Diccionario de supervivencia", "Las palabras clave, de la A a la Z"), lbl="Diccionario"), pg("page", b, run, lbl="Diccionario")]


# ======================================================================= final
def final():
    body = bloque('<h3>Tu progreso</h3>',
                  p('Marca cada casilla cuando lo hayas hecho de verdad, en la calle.'),
                  checklist([("He saludado y dado las gracias en inglés", "Hello, thank you."),
                             ("He pedido que me lo repitan más despacio", "Slowly, please."),
                             ("He comprado algo y he entendido el precio", "How much is it?"),
                             ("He pedido un plato sin picante", "Not spicy, please."),
                             ("He explicado en la farmacia lo que necesitaba", "I need something for…"),
                             ("Me he presentado a alguien nuevo", "My name is…, I'm from Spain."),
                             ("He quedado para un café", "Would you like a coffee?")]),
                  '<div class="promise"><span>Si has marcado tres casillas,</span><span>ya hablas inglés.</span><span>Lo demás es práctica.</span></div>',
                  '<div class="sign"><small>Escríbeme y cuéntame qué tal te va,</small><span class="ph">[Tu nombre]</span></div>')
    return [pg("page", body, LIBRO, lbl="Tu progreso")]


# ======================================================================= índice y montaje
def indice(caps):
    items = []
    for num, (n, titulo, sub) in caps:
        extra = ' class="extra"' if n == "·" else ""
        nn = "" if n == "·" else n
        items.append(f'<li{extra}><span class="n">{nn}</span><span class="t">{e(titulo)}<small>{e(sub)}</small></span><span class="p">{num}</span></li>')
    return bloque('<h3>Qué vas a aprender</h3>', p('Cada capítulo es una situación real. Ábrelo por donde lo necesites.', 'soft'),
                  f'<div class="toc"><ol>{"".join(items)}</ol></div>')


def paginas():
    portada = {"kind": "raw", "body": PORTADA, "lbl": "Portada", "id": "portada"}
    cuerpo = carta() + [None] + como_usar() + pronunciacion() + cap1() + cap2() + cap3() + cap4() + cap5() + cap6() + cap7() + cap8() + cap9() + cap10() + paises() + tarjetas() + diccionario() + final()
    todas = [portada] + cuerpo + [{"kind": "raw", "body": CONTRA, "lbl": "Contraportada"}]
    caps = [(i + 1, x["chapter"]) for i, x in enumerate(todas) if x and x.get("chapter")]
    k = todas.index(None)
    todas[k] = pg("page", indice(caps), LIBRO, lbl="Índice", id="indice")
    for i, x in enumerate(todas):
        if x.get("chapter") and not x.get("id"):
            x["id"] = f"p{i + 1}"
    return todas


INTRO = '''<header class="intro">
  <span class="eyebrow">Libro completo | 6 × 9 pulgadas (15,2 × 22,9 cm)</span>
  <h1>Inglés para valientes</h1>
  <p>Inglés de supervivencia para hispanohablantes de 50 años o más que se van a vivir a Tailandia, Vietnam o Filipinas. Escrito a partir de foros y comunidades de expatriados, jubilados y nómadas, y de la investigación sobre cómo aprenden mejor los adultos.</p>
</header>'''

NOTAS = '''<section class="notes" aria-label="Notas para la edición">
  <div><h2>Antes de imprimir</h2><p>Cambia «TU-DOMINIO.com» por tu dominio en build.py y vuelve a generar el libro: todos los códigos QR se actualizan solos. Pon tu nombre donde aparece [Tu nombre].</p></div>
  <div><h2>Revisión recomendada</h2><p>Que un profesor de inglés revise la pronunciación figurada y que una persona tailandesa y otra vietnamita revisen las palabras locales. Comprueba los teléfonos de emergencia antes de cada edición.</p></div>
  <div><h2>Audios</h2><p>Cada código QR lleva a una pista. Graba cada frase a velocidad normal, luego despacio y con un silencio para repetir. Las frases de «Así lo oirás allí» deberían grabarlas voces asiáticas.</p></div>
</section>'''
