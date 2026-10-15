package com.hearth.inspection;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** Thread-safe in-memory store (tests, local runs). HttpServer handles requests on multiple threads. */
public class MemoryTourStore implements TourStore {
    private final Map<String, List<Tour>> byListing = new ConcurrentHashMap<>();

    @Override
    public Tour schedule(Tour tour) {
        var list = byListing.computeIfAbsent(tour.listingId(), k -> new CopyOnWriteArrayList<>());
        synchronized (list) { // check-then-add must be atomic
            if (isBooked(list, tour)) throw new ConflictException("date already booked: " + tour.date());
            list.add(tour);
        }
        return tour;
    }

    private boolean isBooked(List<Tour> list, Tour tour) {
        return list.stream().anyMatch(t -> t.date().equals(tour.date()));
    }

    @Override
    public List<Tour> forListing(String listingId) {
        return List.copyOf(byListing.getOrDefault(listingId, List.of()));
    }
}
