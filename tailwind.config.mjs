/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				'sans': ['Inter', 'sans-serif'],
				'JetBrainsMono':  ['JetBrains Mono', 'sans-serif'],
			},
			colors: {
				'black-shade': '#09090a',
				'grey-shade': '#19191c',
			}
		},
	},
	plugins: [],
}