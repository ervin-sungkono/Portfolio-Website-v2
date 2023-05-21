const pages = ["/","/about","/design","/project"]

export default async function handler(req, res) {
  const date = Date.now()

  if (req.query.secret !== process.env.SECRET_TOKEN) {
    return res.status(401).json({ message: 'Invalid token' })
  }

  try {
    await Promise.all(pages.map(page => res.revalidate(page)))
    return res.json({ revalidated: true, timeTaken: `${Date.now() - date}ms` })
  } catch (err) {
    console.log(err)
    return res.status(500).send('Error revalidating')
  }
}