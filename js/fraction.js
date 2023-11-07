export default class Fraction {

    static ZERO = Fraction.unsafeFraction(0n);
    static ONE = Fraction.unsafeFraction(1n);
    static TWO = Fraction.unsafeFraction(2n);
    static TEN = Fraction.unsafeFraction(10n);
    static unsafeFraction(numerator, denominator = 1n) {
        const f = Object.create(Fraction.prototype);
        f.p = numerator;
        f.q = denominator;
        return f;
    }

    static gcd(a, b) {
        if (b === 0n) {
            return a;
        }
        return Fraction.gcd(b, a % b);
    }

    static fromNumber(numerator, denominator) {

        function getFraction(x) {
            let float = new Float64Array(1),
                bytes = new Uint8Array(float.buffer);

            float[0] = x;

            let sign = bytes[7] >> 7,
                exponent = ((bytes[7] & 0x7f) << 4 | bytes[6] >> 4) - 0x3ff;

            bytes[7] = 0x3f;
            bytes[6] |= 0xf0;
            let p = BigInt(float[0] * 2 ** 53);
            let q = 1n << 53n;
            if (exponent >= 0) {
                p = p << BigInt(exponent);
            } else {
                q = q << BigInt(-exponent);
            }
            return new Fraction(p * (-1n) ** BigInt(sign), q);
        }

        if (denominator === undefined) {
            return getFraction(numerator);
        } else {
            return getFraction(numerator).div(getFraction(denominator));
        }
    }

    static fromString(s) {
        if (s.indexOf("/") !== -1) {
            const [p, q] = s.split("/");
            return new Fraction(BigInt(p), BigInt(q));
        } else {
            const sign = s.match(/(-?)/)[1] === "-" ? -1n : 1n;
            const integerPart = BigInt(s.match(/(\d+)/)[1]);
            const fractionalPart = s.match(/(\d+)\.(\d*)/);
            if (fractionalPart === null) {
                return new Fraction(sign * integerPart);
            } else {
                const lf = BigInt(fractionalPart[2].length);
                const periodicPart = s.match(/\((\d+?)\)$/);
                if (periodicPart === null) {
                    const q = 10n ** lf;
                    const p = integerPart * q + BigInt(fractionalPart[2]);
                    return new Fraction(sign * p, q);
                } else {
                    const lp = BigInt(periodicPart[1].length);
                    const q = 10n ** lf * (10n ** lp - 1n);
                    const p = integerPart * q + BigInt(fractionalPart[2]) * (10n ** lp - 1n) + BigInt(periodicPart[1]);
                    return new Fraction(sign * p, q);
                }
            }
        }
    }

    constructor(numerator, denominator = 1n) {
        if (denominator === 0n) {
            throw new Error("Denominator cannot be zero");
        }
        const g = Fraction.gcd(numerator, denominator);
        this.p = numerator / g;
        this.q = denominator / g;
        if (this.q < 0) {
            this.p = -this.p;
            this.q = -this.q;
        }
    }

    add(other) {
        return new Fraction(this.p * other.q + other.p * this.q, this.q * other.q);
    }

    sub(other) {
        return new Fraction(this.p * other.q - other.p * this.q, this.q * other.q);
    }

    unsafeSub(other) {
        return Fraction.unsafeFraction(this.p * other.q - other.p * this.q, this.q * other.q);
    }

    mul(other) {
        return new Fraction(this.p * other.p, this.q * other.q);
    }

    unsafeMul(other) {
        return Fraction.unsafeFraction(this.p * other.p, this.q * other.q);
    }

    div(other) {
        return new Fraction(this.p * other.q, this.q * other.p);
    }

    ipow(n) {
        if (n < 0) {
            return this.inverse().pow(-n);
        } else {
            return Fraction.unsafeFraction(this.p ** n, this.q ** n);
        }
    }

    equals(other) {
        return this.p === other.p && this.q === other.q;
    }

    inverse() {
        if (this.p >= 0) {
            return Fraction.unsafeFraction(this.q, this.p);
        } else {
            return Fraction.unsafeFraction(-this.q, -this.p);
        }
    }

    unsafeMediant(other) {
        return Fraction.unsafeFraction(this.p + other.p, this.q + other.q);
    }

    mediant(other) {
        return new Fraction(this.p + other.p, this.q + other.q);
    }

    abs() {
        return Fraction.unsafeFraction(this.p < 0 ? -this.p : this.p, this.q);
    }

    max(other) {
        return this.compare(other) >= 0 ? Fraction.unsafeFraction(this.p, this.q) : Fraction.unsafeFraction(other.p, other.q);
    }

    min(other) {
        return this.compare(other) <= 0 ? Fraction.unsafeFraction(this.p, this.q) : Fraction.unsafeFraction(other.p, other.q);
    }

    floor() {
        if (this.p >= 0) {
            return this.p / this.q;
        } else {
            return this.p / this.q - (this.q !== 1n ? 1n : 0n);
        }
    }

    ceil() {
        if (this.p >= 0) {
            if (this.p % this.q === 0n)
                return this.p / this.q;
            else
                return this.p / this.q + 1n;
        } else {
            return this.p / this.q;
        }
    }

    compare(other) {
        return this.p * other.q - other.p * this.q;
    }

    toString() {
        return this.p + "/" + this.q;
    }

    // Finding the period is hard in general (one algorithm computes discrete log). We will return a generator for the decimal expansion.
    toDecimal() {
        if (this.p !== 0n) {
            const sign = this.p < 0n ? -1n : 1n;
            let unsigned = this.abs();
            let exponent = 0n;
            while (unsigned.compare(Fraction.TEN) >= 0) {
                unsigned = unsigned.div(Fraction.TEN);
                exponent++;
            }
            while (unsigned.compare(Fraction.ONE) < 0) {
                unsigned = unsigned.mul(Fraction.TEN);
                exponent--;
            }
            const nonzeroDigit = unsigned.floor();
            let fractionalPart = unsigned.sub(Fraction.unsafeFraction(nonzeroDigit));
            let fpGenerator = function*() {
                while (fractionalPart.compare(Fraction.ZERO) > 0) {
                    fractionalPart = fractionalPart.mul(Fraction.TEN);
                    const digit = fractionalPart.floor();
                    fractionalPart = fractionalPart.sub(Fraction.unsafeFraction(digit));
                    yield digit;
                }
            }
            return {
                sign: sign, nonzeroPart: nonzeroDigit, exponent: exponent, fractionalPart: fpGenerator()
            }
        } else {
            return {sign: 1n, nonzeroPart: 0n, exponent: 0n};
        }
    }

    valueOf() {
        // strictly speaking, this gives incorrect results for large fractions
        return Number(this.p) / Number(this.q);
    }

    * toContinuedR() {
        yield this.p / this.q;
        if (this.q !== 1n)
            yield* Fraction.unsafeFraction(this.q, this.p % this.q).toContinuedR();
    }

    * toContinued() {
        const nf = this.floor();
        yield nf;
        if (this.q !== 1n)
            yield* Fraction.unsafeFraction(this.p - nf * this.q, this.q).inverse().toContinuedR();
    }

    // assume that l <= n <= r and r.p*l.q-r.q*l.p = 1
    * intermediateFractions2(l, r) {
        let m = l.unsafeMediant(r);
        yield m;
        while (!m.equals(this)) {
            if (m.compare(this) < 0)
                l = m;
            else
                r = m;
            m = l.unsafeMediant(r);
            yield m;
        }
    }

    * intermediateFractions() {
        let l = Fraction.unsafeFraction(this.floor());
        let r = Fraction.unsafeFraction(this.floor() + 1n);
        yield l;
        if (!l.equals(this)) {
            yield r;
            yield* this.intermediateFractions2(l, r);
        }
    }

    rationalApproximation(prec) {
        let prev = Fraction.unsafeFraction(1n, 0n);
        let prevprev = Fraction.unsafeFraction(0n, 1n);
        let i = 0;
        for (const a of this.toContinued()) {
            let curr = Fraction.unsafeFraction(prev.p * a + prevprev.p, prev.q * a + prevprev.q);
            if (this.unsafeSub(curr).abs().compare(prec) <= 0) {
                if (i > 0) {
                    let l = 1n;
                    let r = a;
                    while (l < r) {
                        let m = (l + r) / 2n;
                        if (this.unsafeSub(Fraction.unsafeFraction(prev.p * m + prevprev.p, prev.q * m + prevprev.q)).abs().compare(prec) > 0)
                            l = m + 1n;
                        else
                            r = m;
                    }
                    if (i % 2 === 0)
                        return {
                            fraction: Fraction.unsafeFraction(prev.p * l + prevprev.p, prev.q * l + prevprev.q),
                            left: Fraction.unsafeFraction(prev.p * (l - 1n) + prevprev.p, prev.q * (l - 1n) + prevprev.q),
                            right: Fraction.unsafeFraction(prev.p, prev.q)
                        };
                    else
                        return {
                            fraction: Fraction.unsafeFraction(prev.p * l + prevprev.p, prev.q * l + prevprev.q),
                            right: Fraction.unsafeFraction(prev.p * (l - 1n) + prevprev.p, prev.q * (l - 1n) + prevprev.q),
                            left: Fraction.unsafeFraction(prev.p, prev.q)
                        };
                } else
                    return {
                        fraction: Fraction.unsafeFraction(curr.p, curr.q),
                        left: Fraction.unsafeFraction(prev.p * (a - 1n) + prevprev.p, prev.q * (a - 1n) + prevprev.q),
                        right: Fraction.unsafeFraction(prev.p, prev.q)
                    };
            }
            prevprev = prev;
            prev = curr;
            i++;
        }
    }

}

export function fractionsInInterval(l, r, maxq) {
    let root = l.add(r).div(Fraction.TWO).rationalApproximation(r.sub(l).div(Fraction.TWO));
    while (root.fraction.sub(Fraction.ONE).compare(l) >= 0) {
        root.fraction = root.fraction.sub(Fraction.ONE);
        root.left = root.left.sub(Fraction.ONE);
    }
    let first = root.fraction;
    let last = first;
    first.next = null;
    let left = root.left;
    let right = root.fraction;
    let m = left.unsafeMediant(right);
    while (m.q <= maxq) {
        const c = l.compare(m);
        if (c === 0)
            break;
        if (c < 0) {
            m.next = first;
            first = m;
            right = m;
        } else
            left = m;
        m = left.unsafeMediant(right);
    }
    left = root.fraction;
    right = root.right;
    if (root.fraction.q === 1n) {
        right = root.fraction.add(Fraction.ONE);
        while (r.compare(right) >= 0) {
            left = last.next = right;
            last = last.next;
            last.next = null;
            right = right.add(Fraction.ONE);
        }
    }
    m = left.unsafeMediant(right);
    while (m.q <= maxq) {
        const c = r.compare(m);
        if (c === 0)
            break;
        if (c < 0)
            right = m;
        else {
            m.next = null;
            last.next = m;
            last = last.next;
            left = m;
        }
        m = left.unsafeMediant(right);
    }
    let it = first;
    while (it !== last) {
        m = it.unsafeMediant(it.next);
        if (m.q <= maxq) {
            m.next = it.next;
            it.next = m;
        } else
            it = it.next;
    }
    let flist = [];
    for (it = first; it != null; it = it.next)
        flist.push(it);
    return flist;
}