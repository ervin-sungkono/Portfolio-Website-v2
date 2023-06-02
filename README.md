# Portfolio-Website-v2
An improvement of my old portfolio website, built using NextJS and Tailwind to showcase my projects and designs, this project uses ISR(Incremental Static Regeneration) to increase website performance while reducing server load. 

## Resources
- [Github API](https://api.github.com)
- [Dribbble v2 API](https://developer.dribbble.com/v2/)
- [Animate on Scroll](https://www.npmjs.com/package/aos)
- [Typewriter Effect](https://www.npmjs.com/package/typewriter-effect)
- [Glide JS](https://glidejs.com/)
- [NextJS v13](https://nextjs.org/)
- [Next Themes](https://www.npmjs.com/package/next-themes)
- [TS Particles](https://www.npmjs.com/package/tsparticles)
- [Nodemailer](https://www.npmjs.com/package/nodemailer)
- [React Google ReCAPTCHA](https://www.npmjs.com/package/react-google-recaptcha)

## Key Features
1. Direction Aware Card Hover
2. Scroll Animations using AoS
3. Carousel using Glide JS
4. Responsive Layout
5. Themes Switch (light and dark mode) using next-themes
6. ISR (revalidates every 60 seconds)
7. Dynamic Web using API
8. 404 Page with particle animations (Recently added)
9. Contact Form integration using nodemailer, with ReCAPTCHA v2 (Recently added)

## Preview Image
<img src="https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/images/Portfolio-Website-v2.png" width=480/>

## Installation and Setup
1. Clone this repository
```sh
git clone https://github.com/ervin-sungkono/Portfolio-Website-v2.git
```
2. Setup env variables
```sh
cp .env.example .env
```
| Variable | Description |
| :--- | :--- |
| `DRIBBBLE_TOKEN` | Dribbble API token, get it [here](https://developer.dribbble.com/v2/) |
| `GITHUB_USERNAME` | Your Github username |
| `GITHUB_TOKEN` | Your Github API token(optional), get it [here](https://docs.github.com/en/rest/guides/getting-started-with-the-rest-api?apiVersion=2022-11-28#authenticating) |
| `SECRET_TOKEN` | Secret token for on-demand ISR using /api/revalidate?secret={SECRET_TOKEN} route |
| `SITE_URL` | Your site URL |
| `EMAIL` | Your email for nodemailer |
| `EMAIL_PASS` | Your email's password for nodemailer, see how to get it [here](https://support.google.com/accounts/answer/185833?hl=en) for gmail | 
| `NEXT_PUBLIC_RECAPTCHA_KEY` | Your ReCAPTCHA site key |
| `RECAPTCHA_SECRET` | Your ReCAPTCHA secret, register it [here](https://www.google.com/recaptcha/admin) |

3. Install dependency
```sh
npm install
```
4. Run the app
```sh
npm run dev
```

This project is deployed using Vercel, [click here](https://ervin-sungkono.vercel.app) to see the result.
