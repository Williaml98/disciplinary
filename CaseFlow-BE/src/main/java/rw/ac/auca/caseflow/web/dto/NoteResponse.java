package rw.ac.auca.caseflow.web.dto;

import java.time.Instant;
import rw.ac.auca.caseflow.domain.Note;

public record NoteResponse(Long id, String author, String text, Instant timestamp) {
    public static NoteResponse from(Note note) {
        return new NoteResponse(note.getId(), note.getAuthor(), note.getText(), note.getTimestamp());
    }
}
