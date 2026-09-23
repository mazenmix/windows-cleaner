package com.mazenmix.mxfieldtracker

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class QueueDb(context: Context) : SQLiteOpenHelper(context, "mx_tracker.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            "CREATE TABLE queue (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "payload TEXT NOT NULL," +
                "created INTEGER NOT NULL)"
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    fun add(payload: String) {
        writableDatabase.execSQL(
            "INSERT INTO queue(payload,created) VALUES(?,?)",
            arrayOf(payload, System.currentTimeMillis())
        )
        writableDatabase.execSQL(
            "DELETE FROM queue WHERE id NOT IN (" +
                "SELECT id FROM queue ORDER BY id DESC LIMIT 1000)"
        )
    }

    fun peek(limit: Int = 50): List<Pair<Long, String>> {
        val out = mutableListOf<Pair<Long, String>>()
        readableDatabase.rawQuery(
            "SELECT id,payload FROM queue ORDER BY id ASC LIMIT ?",
            arrayOf(limit.toString())
        ).use { c ->
            while (c.moveToNext()) {
                out += c.getLong(0) to c.getString(1)
            }
        }
        return out
    }

    fun remove(id: Long) {
        writableDatabase.execSQL("DELETE FROM queue WHERE id=?", arrayOf(id))
    }
}