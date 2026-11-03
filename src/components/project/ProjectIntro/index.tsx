import styles from './style.module.css';

export function ProjectIntro() {
  return (
    <section className={`page-heading ${styles.collectionIntro}`}>
      <p className="editorial-label">Portfolio / Projects</p>
      <h1>
        Projects Built
        <br />
        <span>to Explore Ideas.</span>
      </h1>
      <p>
        A collection of web applications, mobile projects, and development experiments. Explore the
        interface and the source behind it.
      </p>
    </section>
  );
}
