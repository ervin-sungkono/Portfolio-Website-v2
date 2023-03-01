const pages = ["/","/about","/dribbble","/github"]

export default async function handler(req, res) {
    if (req.query.secret !== process.env.SECRET_TOKEN) {
      return res.status(401).json({ message: 'Invalid token' })
    }
  
    try {
      pages.forEach(async(page) => await res.revalidate(page))
      return res.json({ revalidated: true })
    } catch (err) {
      return res.status(500).send('Error revalidating')
    }
}