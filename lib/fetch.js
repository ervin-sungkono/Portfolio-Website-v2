require('dotenv').config()

export async function getDribbbleUserData(per_page = 100, limit = false){
    let page = 1
    let dribbbleShots = []
    let shots
    do{
        shots = await fetch(`https://api.dribbble.com/v2/user/shots?access_token=${process.env.DRIBBBLE_TOKEN}&page=${page}&per_page=${per_page}`)
        .then(res => res.json())
        .catch(error => console.log(error))
        dribbbleShots = [...dribbbleShots, ...shots]
        page++
    }while(shots.length === per_page && !limit)
    return dribbbleShots ?? []
}

const githubUsername = process.env.GITHUB_USERNAME
const headersConfig = process.env.GITHUB_TOKEN ? {
    Authorization : `Bearer ${process.env.GITHUB_TOKEN}`
} : {}

export async function getGithubUserData(){
    const githubProjects = await fetch(`https://api.github.com/users/${githubUsername}/repos?per_page=100&sort=created`, {
            headers: headersConfig
        })
        .then(res => res.json())
        .then(projects => {
            return Promise.all(projects.map(async(project)=> {
                const projectInfo = await fetch(`https://raw.githubusercontent.com/${githubUsername}/web-assets/master/data/projects/${project.id}.json`)
                                    .then(res => {
                                        if(res.ok) return res.json()
                                    })
                                    .catch(error => console.log(error))
                if(!projectInfo) return null
                return {
                    ...project,
                    name: project.name.replaceAll('-', ' '),
                    topics: projectInfo?.topics ?? [],
                    category: projectInfo?.category ?? [],
                    image: projectInfo?.image ?? `https://raw.githubusercontent.com/${githubUsername}/web-assets/master/images/no-image.png`
                }
            }))
        })
        .catch(error => console.log(error))
    return githubProjects?.filter(project => project !== null) ?? []
}

export async function getProjectCategories(){
    const categories = await fetch(`https://raw.githubusercontent.com/${githubUsername}/web-assets/master/data/categories.json`)
                        .then(res => res.json())
                        .then(data => data.categories)
                        .catch(error => console.log(error))
    return categories ?? []
}

export async function getSkillsData(){
    const skills = await fetch(`https://raw.githubusercontent.com/${githubUsername}/web-assets/master/icons/icon.json`)
                    .then(res => res.json())
                    .then(data => data.icons_url.map(icon => ({label: icon, src: `https://raw.githubusercontent.com/${githubUsername}/web-assets/master/icons/${icon.toLowerCase().replaceAll(' ', '')}.svg`})))
                    .catch(error => console.log(error))
    return skills ?? []
}