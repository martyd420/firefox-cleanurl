"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  compileParams, matchesPattern, cleanUrl, cleanQuery,
  isDomainAllowed, isValidParamName, normalizeDomain,
} = require("../shared.js");

// Deterministic stand-in for randomString so "random" mode is testable.
const fixedRandom = () => "RAND";

const compiled = compileParams([
  { name: "utm_source", mode: "remove",  value: "" },
  { name: "utm_medium", mode: "remove",  value: "" },
  { name: "ref",        mode: "replace", value: "clean" },
  { name: "sid",        mode: "random",  value: "" },
  { name: "utm_*",      mode: "remove",  value: "" },
  { name: "*clid",      mode: "remove",  value: "" },
]);

// ── matchesPattern ────────────────────────────────────────────────────────────
test("matchesPattern prefix/suffix/contains/exact", () => {
  assert.equal(matchesPattern("utm_*", "utm_campaign"), true);
  assert.equal(matchesPattern("*clid", "fbclid"), true);
  assert.equal(matchesPattern("*track*", "xtrackingy"), true);
  assert.equal(matchesPattern("*", "anything"), true);
  assert.equal(matchesPattern("ref", "ref"), true);
  assert.equal(matchesPattern("ref", "referrer"), false);
});

// ── cleanUrl: removal ─────────────────────────────────────────────────────────
test("removes a single tracking param", () => {
  const r = cleanUrl("https://example.com/p?utm_source=news&id=5", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/p?id=5");
  assert.equal(r.count, 1);
});

test("returns null when there is nothing to clean", () => {
  assert.equal(cleanUrl("https://example.com/p?id=5", compiled, fixedRandom), null);
});

test("counts duplicate occurrences of a key only once", () => {
  const r = cleanUrl("https://example.com/?utm_source=a&utm_source=b&id=5", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/?id=5");
  assert.equal(r.count, 1);
});

// ── cleanUrl: replace ─────────────────────────────────────────────────────────
test("replace sets the configured value", () => {
  const r = cleanUrl("https://example.com/?ref=abc", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/?ref=clean");
  assert.equal(r.count, 1);
});

test("replace is a no-op (no loop) once the value already matches", () => {
  assert.equal(cleanUrl("https://example.com/?ref=clean", compiled, fixedRandom), null);
});

test("replace collapses duplicates even when one already matches", () => {
  const r = cleanUrl("https://example.com/?ref=clean&ref=other", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/?ref=clean");
  assert.equal(r.count, 1);
});

// ── cleanUrl: random ──────────────────────────────────────────────────────────
test("random replaces the value with generated text", () => {
  const r = cleanUrl("https://example.com/?sid=12345", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/?sid=RAND");
  assert.equal(r.count, 1);
});

// ── encoding preservation (plan 2.2) ──────────────────────────────────────────
test("untouched params keep their original encoding", () => {
  const r = cleanUrl("https://example.com/?utm_source=x&q=a%20b%2Bc", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/?q=a%20b%2Bc");
});

test("plus sign in an untouched param is not rewritten to %20", () => {
  const r = cleanUrl("https://example.com/?utm_source=x&q=a+b", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/?q=a+b");
});

// ── fragment cleaning (plan 2.1) ──────────────────────────────────────────────
test("cleans a query-style fragment", () => {
  const r = cleanUrl("https://example.com/#utm_source=x&y=1", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/#y=1");
  assert.equal(r.count, 1);
});

test("cleans the query part of an SPA route fragment", () => {
  const r = cleanUrl("https://example.com/#/path?utm_source=x&id=2", compiled, fixedRandom);
  assert.equal(r.url, "https://example.com/#/path?id=2");
  assert.equal(r.count, 1);
});

test("leaves a plain (non-query) fragment alone", () => {
  assert.equal(cleanUrl("https://example.com/page#section", compiled, fixedRandom), null);
});

test("cleans params in both search and fragment", () => {
  const r = cleanUrl("https://example.com/?utm_source=a#utm_medium=b", compiled, fixedRandom);
  assert.equal(r.count, 2);
});

// ── cleanQuery directly ───────────────────────────────────────────────────────
test("cleanQuery handles a key with no value", () => {
  const r = cleanQuery("utm_source&id=5", compiled, fixedRandom);
  assert.equal(r.query, "id=5");
  assert.equal(r.count, 1);
});

// ── isDomainAllowed ───────────────────────────────────────────────────────────
test("allowlist matches domain and subdomains only", () => {
  const list = ["example.com"];
  assert.equal(isDomainAllowed("example.com", list), true);
  assert.equal(isDomainAllowed("shop.example.com", list), true);
  assert.equal(isDomainAllowed("notexample.com", list), false);
  assert.equal(isDomainAllowed("example.com.evil.com", list), false);
});

// ── validators ────────────────────────────────────────────────────────────────
test("isValidParamName accepts supported patterns", () => {
  for (const ok of ["utm_source", "utm_*", "*clid", "*track*", "*", "mc.eid", "a~b", "x-y"]) {
    assert.equal(isValidParamName(ok), true, ok);
  }
});

test("isValidParamName rejects junk and multi-asterisk", () => {
  for (const bad of ["a b", "a=b", "a&b", "a*b*c", "a*b", "", "a*b"]) {
    assert.equal(isValidParamName(bad), false, JSON.stringify(bad));
  }
});

test("normalizeDomain strips protocol/path and converts IDN to punycode", () => {
  assert.equal(normalizeDomain("https://Example.com/path?x"), "example.com");
  assert.equal(normalizeDomain("háčky.cz"), "xn--hky-ela4t.cz");
  assert.equal(normalizeDomain("foo bar"), null);
  assert.equal(normalizeDomain("localhost"), null);
  assert.equal(normalizeDomain(""), null);
});
