/* Палитра и шрифты Tailwind. Главный акцент сайта — ytGreen (имя историческое, цвет теперь ультрамарин).
   Хочешь другой цвет сайта — поменяй ytGreen и ytGreenHover здесь + --accent в css/style.css. */
tailwind.config = {
  darkMode: 'class',
  theme: { extend: {
    fontFamily: { sans: ['Onest', 'sans-serif'], display: ['Unbounded', 'sans-serif'] },
    colors: { ytBlack: '#0a0b10', ytGray: '#14151d', ytLightGray: '#a09aa8', ytGreen: '#5b6cff', ytGreenHover: '#4655e6' },
    maxWidth: { '8xl': '1600px' }
  } }
}
