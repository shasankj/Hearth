package com.hearth.inspection;

import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

/**
 * Dependency-free tests: run with `java -ea`. In a real repo these would be JUnit 5 tests.
 * If JDBC_URL is set (and the postgres driver is on the classpath) the same contract is checked against Postgres.
 */
public class InspectionTest {
    private static final LocalDate DAY = LocalDate.now().plusDays(30);

    public static void main(String[] args) throws Exception {
        contract(new MemoryTourStore(), "memory");
        concurrentBookingsAllowExactlyOne(new MemoryTourStore());
        if (System.getenv("JDBC_URL") != null) contract(App.storeFromEnv(), "postgres");
        System.out.println("ALL JAVA TESTS PASSED");
    }

    /** Behavior every TourStore must have, whatever its storage. */
    static void contract(TourStore s, String name) {
        String id = "H-1001";
        LocalDate d = DAY.plusDays((long) (Math.random() * 100000));
        s.schedule(new Tour(id, d, null));
        expectConflict(s, new Tour(id, d, null));
        s.schedule(new Tour(id, d.plusDays(1), null));
        assert s.forListing(id).stream().anyMatch(t -> t.date().equals(d)) : name + ": booking not listed";
        System.out.println("contract OK: " + name);
    }

    static void expectConflict(TourStore s, Tour t) {
        try {
            s.schedule(t);
            throw new AssertionError("expected ConflictException");
        } catch (ConflictException expected) { }
    }

    static void concurrentBookingsAllowExactlyOne(TourStore s) throws Exception {
        var wins = new AtomicInteger();
        var threads = IntStream.range(0, 20).mapToObj(i -> new Thread(() -> book(s, wins))).toList();
        for (var t : threads) t.start();
        for (var t : threads) t.join();
        if (wins.get() != 1) throw new AssertionError("expected 1 winner, got " + wins.get());
        System.out.println("concurrency OK: 20 threads, 1 winner");
    }

    static void book(TourStore s, AtomicInteger wins) {
        try {
            s.schedule(new Tour("L9", DAY, null));
            wins.incrementAndGet();
        } catch (ConflictException ignored) { }
    }
}
