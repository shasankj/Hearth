package com.hearth.inspection;

import java.util.List;

/** Storage port: the HTTP layer depends on this interface, so tests use memory and production uses Postgres. */
public interface TourStore {
    /** @throws ConflictException if the date is already booked, NotFoundException for an unknown listing */
    Tour schedule(Tour tour);

    List<Tour> forListing(String listingId);
}
