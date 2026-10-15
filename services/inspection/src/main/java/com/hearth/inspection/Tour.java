package com.hearth.inspection;

import java.time.LocalDate;

/** A record is an immutable data class: constructor, accessors, equals/hashCode/toString for free. */
public record Tour(String listingId, LocalDate date, String userId) {
    public Tour {
        if (listingId == null || listingId.isBlank()) throw new IllegalArgumentException("listingId required");
        if (date == null) throw new IllegalArgumentException("date required");
    }
}
