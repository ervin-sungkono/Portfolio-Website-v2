export async function getDribbbleUserData(per_page = 100, limit = false){
    let page = 1
    let dribbbleShots = []
    let shots
    do{
        shots = await fetch(`https://api.dribbble.com/v2/user/shots?access_token=${process.env.NEXT_PUBLIC_DRIBBBLE_TOKEN}&page=${page}&per_page=${per_page}`)
        .then(res => res.json())
        .catch(error => console.log(error))
        dribbbleShots = [...dribbbleShots, ...shots]
        page++
    }while(shots.length === per_page && !limit)
    return dribbbleShots ?? []
}

const githubUsername = process.env.NEXT_PUBLIC_GITHUB_USERNAME

export async function getGithubUserData(){
    const githubProjects = await fetch(`https://api.github.com/users/${githubUsername}/starred`, {
            headers: {
                Authorization : `Bearer ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`
            }
        })
        .then(res => res.json())
        .then(projects => {
            const filteredProjects = projects
                                    .filter(project => project.owner.login === githubUsername)
                                    .sort((projectA, projectB) => new Date(projectB.created_at) - new Date(projectA.created_at))
            return Promise.all(filteredProjects.map(async(project)=> {
                const projectInfo = await fetch(`https://raw.githubusercontent.com/${githubUsername}/web-assets/master/data/projects/${project.id}.json`)
                                    .then(res => res.json())
                                    .catch(error => console.log(error))
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
    return githubProjects ?? []
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
                    .then(data => data.icons_url)
                    .catch(error => console.log(error))
    return skills ?? []
}