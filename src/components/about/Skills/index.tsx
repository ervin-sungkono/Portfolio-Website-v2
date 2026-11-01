import Image from 'next/image';
import { getPortfolio } from '@/lib/content';
import styles from './style.module.css';

const skillGroups = [
  {
    title: 'Web & Interface',
    labels: ['React', 'Next.js', 'JavaScript', 'HTML', 'CSS', 'Tailwind', 'Sass', 'Bootstrap'],
  },
  {
    title: 'Application Development',
    labels: ['Node.js', 'Laravel', 'MySQL', 'Java', 'Android Studio'],
  },
  { title: 'Design & Tools', labels: ['Figma', 'Git'] },
];

export async function Skills() {
  const { skills } = await getPortfolio();
  const groups = skillGroups.map(({ title, labels }) => ({
    title,
    items: skills.filter((skill) => labels.includes(skill.label)),
  }));
  return (
    <section className={`section ${styles.skills}`}>
      <div className={styles.skillsHeading}>
        <p className="eyebrow">Skills & Tools</p>
        <h2>Tools I Work With.</h2>
        <p>
          A background across frontend development, application development, and interface design.
        </p>
      </div>
      <div className={styles.skillGroups}>
        {groups.map((group) => (
          <div key={group.title} className={styles.skillGroup}>
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((skill) => (
                <li key={skill.icon} className={styles.skillItem}>
                  <Image
                    src={`https://raw.githubusercontent.com/ervin-sungkono/web-assets/master/icons/${skill.icon}.svg`}
                    alt=""
                    width={28}
                    height={28}
                    unoptimized
                  />
                  <span>{skill.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
