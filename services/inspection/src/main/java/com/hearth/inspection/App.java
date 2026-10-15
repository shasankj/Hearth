package com.hearth.inspection;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

public class App {
    private final TourStore store;

    App(TourStore store) {
        this.store = store;
    }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8081"));
        new App(storeFromEnv()).start(port);
    }

    /** JDBC_URL set => Postgres (production/Compose); otherwise in-memory (local experiments). */
    static TourStore storeFromEnv() {
        String url = System.getenv("JDBC_URL");
        if (url == null) return new MemoryTourStore();
        return new JdbcTourStore(url, System.getenv("DB_USER"), System.getenv("DB_PASSWORD"));
    }

    HttpServer start(int port) throws IOException {
        var server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/healthz", ex -> Http.send(ex, 200, "{\"ok\":true}"));
        server.createContext("/inspections", this::handle);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();
        return server;
    }

    private void handle(HttpExchange ex) throws IOException {
        try {
            dispatch(ex);
        } catch (RuntimeException e) {
            fail(ex, e);
        }
    }

    private void dispatch(HttpExchange ex) throws IOException {
        if ("POST".equals(ex.getRequestMethod())) create(ex);
        else list(ex);
    }

    private void fail(HttpExchange ex, RuntimeException e) throws IOException {
        int status = statusFor(e);
        if (status == 500) e.printStackTrace(); // details stay in our logs
        Http.send(ex, status, Http.error(status == 500 ? "internal error" : e.getMessage()));
    }

    static int statusFor(RuntimeException e) {
        if (e instanceof ConflictException) return 409;
        if (e instanceof NotFoundException) return 404;
        if (e instanceof IllegalArgumentException || e instanceof DateTimeException) return 400;
        return 500;
    }

    private void create(HttpExchange ex) throws IOException {
        var form = Http.form(new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        var date = LocalDate.parse(form.get("date"));
        if (!date.isAfter(LocalDate.now())) throw new IllegalArgumentException("date must be in the future");
        var tour = new Tour(form.get("listingId"), date, form.get("userId"));
        Http.send(ex, 201, Http.json(store.schedule(tour)));
    }

    private void list(HttpExchange ex) throws IOException {
        String id = ex.getRequestURI().getPath().replaceFirst("^/inspections/?", "");
        var items = store.forListing(id).stream().map(Http::json).collect(Collectors.joining(","));
        Http.send(ex, 200, "[" + items + "]");
    }
}
