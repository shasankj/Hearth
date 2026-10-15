package com.hearth.inspection;

/** Checked-vs-unchecked: unchecked here because callers cannot recover; the HTTP layer maps it to 409. */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
