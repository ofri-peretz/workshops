// Relay's room: who gets in, who stays in, and when answers count.
// Mirrors relay_try_join (migrations/20261108_right_code_first.sql), store.mjs tryJoin, core.mjs control
// (start / signout / close / reveal) and handler.mjs /answer. Thresholds are scaled down so the
// model checker reaches them: IP_LIMIT stands for 5, ROOM_LIMIT for 30.
//
//   quint run specs/relay.qnt --main=relayFixed --invariant=safe --max-steps=30 --max-samples=20000
//   quint run specs/relay.qnt --invariant=safe --main=relayOldOrder   (finds the shared-Wi-Fi lockout)
//   quint test specs/relay.qnt --main=relayFixed
module relay {
  type Phone = str
  type Ip = str
  type Outcome = str // "ok" | "wrong" | "rate_limited" | "locked" | "expired" | "closed" | "none"

  pure val PHONES: Set[Phone] = Set("p1", "p2", "p3")
  pure val IPS: Set[Ip] = Set("venue", "home")
  pure val IP_LIMIT = 2
  pure val ROOM_LIMIT = 3
  // the fix under test: the right code is checked before the per-network limit
  const RIGHT_CODE_FIRST: bool

  var live: bool          // the presenter opened the room (Go live), not yet closed or timed out
  var joinable: bool      // the join code is within its window
  var locked: bool        // too many wrong codes across the room: joining paused
  var code: int           // the current code's version; every Go live / New code / Sign everyone out makes a new one
  var ipFails: Ip -> int
  var roomFails: int
  var inRoom: Set[Phone]  // phones with a session in this run
  var shown: bool         // the current question was revealed
  var answered: Set[Phone]
  // what the last action did, for the invariants
  var lastJoin: { phone: Phone, ip: Ip, guess: int, outcome: Outcome }
  var lastAnswer: { phone: Phone, accepted: bool, wasShown: bool, wasIn: bool, wasLive: bool }
  var signedOut: Set[Phone] // phones removed by Sign everyone out, until they rejoin

  val noJoin = { phone: "", ip: "", guess: -1, outcome: "none" }
  val noAnswer = { phone: "", accepted: false, wasShown: false, wasIn: false, wasLive: false }

  action init = all {
    live' = false, joinable' = false, locked' = false, code' = 0,
    ipFails' = IPS.mapBy(_ => 0), roomFails' = 0,
    inRoom' = Set(), shown' = false, answered' = Set(),
    lastJoin' = noJoin, lastAnswer' = noAnswer, signedOut' = Set(),
  }

  // relay_try_join, with the order switch
  pure def tryJoin(isLive: bool, isLocked: bool, isJoinable: bool, right: bool, fails: int, rightFirst: bool): Outcome =
    if (not(isLive)) "closed"
    else if (isLocked) "locked"
    else if (not(isJoinable)) "expired"
    else if (rightFirst and right) "ok"
    else if (fails >= IP_LIMIT) "rate_limited"
    else if (right) "ok"
    else "wrong"

  action join(p: Phone, ip: Ip, guess: int): bool = {
    val out = tryJoin(live, locked, joinable, guess == code, ipFails.get(ip), RIGHT_CODE_FIRST)
    val wrongNow = out == "wrong"
    val lockNow = wrongNow and roomFails + 1 >= ROOM_LIMIT
    all {
      inRoom' = if (out == "ok") inRoom.union(Set(p)) else inRoom,
      signedOut' = if (out == "ok") signedOut.exclude(Set(p)) else signedOut,
      ipFails' = if (wrongNow) ipFails.set(ip, ipFails.get(ip) + 1) else ipFails,
      roomFails' = if (wrongNow) roomFails + 1 else roomFails,
      locked' = (locked or lockNow),
      lastJoin' = { phone: p, ip: ip, guess: guess, outcome: if (lockNow) "locked" else out },
      lastAnswer' = noAnswer,
      live' = live, joinable' = joinable, code' = code, shown' = shown, answered' = answered,
    }
  }

  // Go live: an empty room, a new code, the failure counts start over
  action goLive = all {
    live' = true, joinable' = true, locked' = false, code' = code + 1,
    ipFails' = IPS.mapBy(_ => 0), roomFails' = 0,
    inRoom' = Set(), shown' = false, answered' = Set(),
    lastJoin' = noJoin, lastAnswer' = noAnswer, signedOut' = Set(),
  }
  action newCode = all {
    live, code' = code + 1, joinable' = true, locked' = false,
    live' = live, ipFails' = ipFails, roomFails' = roomFails, inRoom' = inRoom, shown' = shown, answered' = answered,
    lastJoin' = noJoin, lastAnswer' = noAnswer, signedOut' = signedOut,
  }
  // Sign everyone out: a new code and every session gone; the step stays
  action signOutAll = all {
    live, code' = code + 1, joinable' = true, locked' = false,
    signedOut' = signedOut.union(inRoom), inRoom' = Set(),
    live' = live, ipFails' = ipFails, roomFails' = roomFails, shown' = shown, answered' = answered,
    lastJoin' = noJoin, lastAnswer' = noAnswer,
  }
  // Kick everyone out = Close: the doors shut; phones keep their place but every phone call is refused
  action close = all {
    live' = false, joinable' = false,
    locked' = locked, code' = code, ipFails' = ipFails, roomFails' = roomFails, inRoom' = inRoom, shown' = shown, answered' = answered,
    lastJoin' = noJoin, lastAnswer' = noAnswer, signedOut' = signedOut,
  }
  action expire = all {
    live, joinable' = false,
    live' = live, locked' = locked, code' = code, ipFails' = ipFails, roomFails' = roomFails, inRoom' = inRoom, shown' = shown, answered' = answered,
    lastJoin' = noJoin, lastAnswer' = noAnswer, signedOut' = signedOut,
  }
  action reveal = all {
    shown' = true,
    live' = live, joinable' = joinable, locked' = locked, code' = code, ipFails' = ipFails, roomFails' = roomFails, inRoom' = inRoom, answered' = answered,
    lastJoin' = noJoin, lastAnswer' = noAnswer, signedOut' = signedOut,
  }
  action nextQuestion = all {
    shown' = false, answered' = Set(),
    live' = live, joinable' = joinable, locked' = locked, code' = code, ipFails' = ipFails, roomFails' = roomFails, inRoom' = inRoom,
    lastJoin' = noJoin, lastAnswer' = noAnswer, signedOut' = signedOut,
  }
  // handler.mjs /answer: the doors open, a session in this run, the question not yet revealed
  action answer(p: Phone): bool = {
    val ok = live and inRoom.contains(p) and not(shown)
    all {
      answered' = if (ok) answered.union(Set(p)) else answered,
      lastAnswer' = { phone: p, accepted: ok, wasShown: shown, wasIn: inRoom.contains(p), wasLive: live },
      live' = live, joinable' = joinable, locked' = locked, code' = code, ipFails' = ipFails, roomFails' = roomFails, inRoom' = inRoom, shown' = shown,
      lastJoin' = noJoin, signedOut' = signedOut,
    }
  }

  action step = any {
    nondet p = PHONES.oneOf()
    nondet ip = IPS.oneOf()
    nondet g = Set(code, code - 1, code + 7).oneOf() // the right code, an old one, a typo
    any { join(p, ip, g), answer(p) },
    goLive, newCode, signOutAll, close, expire, reveal, nextQuestion,
  }

  // ---- what must always hold ----------------------------------------------------------------
  // On shared venue Wi-Fi the right code gets in, whatever typos came before (unless the whole room is locked).
  val rightCodeAlwaysAdmits =
    (lastJoin.outcome != "none" and lastJoin.guess == code and live and joinable and not(locked))
      implies lastJoin.outcome == "ok"
  // A code from before Go live / New code / Sign everyone out never admits anyone.
  val oldCodeNeverAdmits = (lastJoin.outcome == "ok") implies lastJoin.guess == code
  // A closed room admits nobody.
  val closedAdmitsNobody = (lastJoin.outcome == "ok") implies live
  // No answer counts after the reveal, from a phone outside the run, or while the doors are shut.
  val answersOnlyWhileOpen = lastAnswer.accepted implies (not(lastAnswer.wasShown) and lastAnswer.wasIn and lastAnswer.wasLive)
  // Signed-out phones hold no session until they rejoin with the new code.
  val signedOutAreOut = signedOut.intersect(inRoom) == Set()
  // The room locks only after enough wrong codes.
  val lockNeedsFailures = locked implies roomFails >= ROOM_LIMIT

  val safe = rightCodeAlwaysAdmits and oldCodeNeverAdmits and closedAdmitsNobody and answersOnlyWhileOpen and signedOutAreOut and lockNeedsFailures
}

// Today's relay: the right code first.
module relayFixed {
  import relay(RIGHT_CODE_FIRST = true).*
  // ---- witnesses: scenarios the model must allow (not hollow) ------------------------------
  run venueTyposThenRightCodeTest = init
    .then(goLive)
    .then(join("p1", "venue", 99)).then(join("p2", "venue", 99))
    .then(join("p3", "venue", code))
    .expect(lastJoin.outcome == "ok" and inRoom.contains("p3"))
  run signOutThenRejoinTest = init
    .then(goLive).then(join("p1", "venue", code))
    .then(signOutAll)
    .expect(not(inRoom.contains("p1")))
    .then(join("p1", "venue", code - 1)).expect(lastJoin.outcome != "ok")
    .then(join("p1", "venue", code)).expect(lastJoin.outcome == "ok")
  run noAnswerAfterRevealTest = init
    .then(goLive).then(join("p1", "home", code)).then(reveal).then(answer("p1"))
    .expect(not(lastAnswer.accepted))
  run closedRefusesTheRightCodeTest = init
    .then(goLive).then(close).then(join("p1", "home", code))
    .expect(lastJoin.outcome == "closed")
}

// The old order (per-network limit before the code): the model checker finds the venue lockout.
module relayOldOrder {
  import relay(RIGHT_CODE_FIRST = false).*
}
