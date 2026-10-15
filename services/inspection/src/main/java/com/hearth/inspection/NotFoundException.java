package com.hearth.inspection;

/** Unknown listing. The HTTP layer maps it to 404. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
