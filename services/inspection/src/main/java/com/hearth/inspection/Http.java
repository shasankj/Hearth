package com.hearth.inspection;

import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

/** Tiny HTTP helpers so handlers stay short. */
final class Http {
    private Http() {}

    static void send(HttpExchange ex, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.sendResponseHeaders(status, bytes.length);
        try (var out = ex.getResponseBody()) { out.write(bytes); }
    }

    static String decode(String s) {
        return URLDecoder.decode(s, StandardCharsets.UTF_8);
    }

    static Map<String, String> form(String body) {
        return Arrays.stream(body.split("&")).filter(s -> s.contains("="))
            .map(s -> s.split("=", 2)).collect(Collectors.toMap(a -> decode(a[0]), a -> decode(a[1]), (a, b) -> b));
    }

    static String esc(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    static String error(String message) {
        return "{\"error\":\"" + esc(message) + "\"}";
    }

    static String json(Tour t) {
        String user = t.userId() == null ? "null" : "\"" + esc(t.userId()) + "\"";
        return "{\"listingId\":\"" + esc(t.listingId()) + "\",\"date\":\"" + t.date() + "\",\"userId\":" + user + "}";
    }
}
