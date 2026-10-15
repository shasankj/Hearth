package com.hearth.inspection;

import java.sql.Connection;
import java.sql.Date;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;

/**
 * Postgres-backed store. The UNIQUE (listing_id, date) constraint is the real double-booking guard:
 * it holds across many service instances, unlike an in-JVM lock. (Production: use a pool such as HikariCP.)
 */
public class JdbcTourStore implements TourStore {
    private static final String INSERT = "INSERT INTO tours (listing_id, user_id, date) VALUES (?, CAST(? AS uuid), ?) ON CONFLICT (listing_id, date) DO NOTHING";
    private static final String SELECT = "SELECT date, user_id FROM tours WHERE listing_id = ? ORDER BY date";
    private final String url;
    private final String user;
    private final String password;

    public JdbcTourStore(String url, String user, String password) {
        this.url = url;
        this.user = user;
        this.password = password;
    }

    private Connection open() throws SQLException {
        return DriverManager.getConnection(url, user, password);
    }

    @Override
    public Tour schedule(Tour tour) {
        try (var conn = open(); var ps = conn.prepareStatement(INSERT)) {
            bind(ps, tour);
            if (ps.executeUpdate() == 0) throw new ConflictException("date already booked: " + tour.date());
            return tour;
        } catch (SQLException e) {
            throw translate(e);
        }
    }

    private void bind(PreparedStatement ps, Tour tour) throws SQLException {
        ps.setString(1, tour.listingId());
        if (tour.userId() == null) ps.setNull(2, Types.VARCHAR);
        else ps.setString(2, tour.userId());
        ps.setDate(3, Date.valueOf(tour.date()));
    }

    /** SQLState 23503 = foreign key violation = the listing does not exist. */
    private RuntimeException translate(SQLException e) {
        if ("23503".equals(e.getSQLState())) return new NotFoundException("unknown listing");
        return new IllegalStateException("database error", e);
    }

    @Override
    public List<Tour> forListing(String listingId) {
        try (var conn = open(); var ps = conn.prepareStatement(SELECT)) {
            ps.setString(1, listingId);
            return readAll(ps, listingId);
        } catch (SQLException e) {
            throw translate(e);
        }
    }

    private List<Tour> readAll(PreparedStatement ps, String listingId) throws SQLException {
        var out = new ArrayList<Tour>();
        try (var rs = ps.executeQuery()) {
            while (rs.next()) out.add(new Tour(listingId, rs.getDate(1).toLocalDate(), rs.getString(2)));
        }
        return out;
    }
}
