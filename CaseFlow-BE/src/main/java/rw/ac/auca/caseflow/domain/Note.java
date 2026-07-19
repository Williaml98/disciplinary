package rw.ac.auca.caseflow.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "note")
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "case_id", nullable = false)
    private DisciplinaryCase disciplinaryCase;

    @Column(nullable = false)
    private String author;

    @Column(nullable = false, length = 2000)
    private String text;

    @Column(nullable = false)
    private Instant timestamp;

    protected Note() {
    }

    public Note(String author, String text, Instant timestamp) {
        this.author = author;
        this.text = text;
        this.timestamp = timestamp;
    }

    public Long getId() {
        return id;
    }

    public String getAuthor() {
        return author;
    }

    public String getText() {
        return text;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    void setDisciplinaryCase(DisciplinaryCase disciplinaryCase) {
        this.disciplinaryCase = disciplinaryCase;
    }
}
