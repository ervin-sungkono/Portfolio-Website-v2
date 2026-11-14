import styles from './style.module.css';

export function ContactIntro() {
  return (
    <section className={`page-heading ${styles.heading}`}>
      <div className={styles.headingCopy}>
        <h1>
          A Good Conversation
          <br />
          <span>Starts Here.</span>
        </h1>
        <p>For an opportunity, a collaboration, or a question about something I’ve built.</p>
      </div>
    </section>
  );
}
