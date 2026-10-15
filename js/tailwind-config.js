/* Палитра и шрифты Tailwind. Главный акцент сайта — ytGreen (имя историческое, цвет теперь красный «кинозал»).
   Хочешь другой цвет сайта — поменяй ytGreen и ytGreenHover здесь + --accent в css/style.css. */
tailwind.config = {
  darkMode: 'class',
  theme: { extend: {
    fontFamily: { sans: ['Onest', 'sans-serif'], display: ['Unbounded', 'sans-serif'] },
    colors: { ytBlack: '#0e0d13', ytGray: '#1a1823', ytLightGray: '#a09aa8', ytGreen: '#e8403f', ytGreenHover: '#c92f2e' },
    maxWidth: { '8xl': '1600px' }
  } }
}
