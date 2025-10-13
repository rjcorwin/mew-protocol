# Research p7l-plane-support

## References

- **Vehicle platform design patterns** – Unreal Engine and Unity both recommend modelling moving platforms as actors with attachment offsets, which map neatly to our lifecycle manager's passenger offsets.
- **Flight simulator heading conventions** – Aviation typically measures heading in degrees clockwise from true north. We retain the math-friendly 0°=east convention but document it clearly and leave room to adopt a navigation library later.
- **Altitude encoding** – Multiplayer titles often treat altitude as an optional dimension for 2.5D games (e.g., Ragnarok Online). We'll follow suit by keeping altitude optional so existing clients can ignore it safely.

## Experiments

- Prototyped altitude handling by adding a `z` component to the transport position vector and verifying that carrying passengers simply offsets the new axis.
- Confirmed the movement stream encoder can extend to an eighth field without breaking legacy decoders by versioning the payload (`VERSION_TAG = '2'`).

## Outstanding Topics

- Visualisation of altitude differences is deferred; future milestones may add UI overlays or colour coding.
- Landing/take-off sequences are simplified to instantaneous altitude adjustments; a later milestone can introduce acceleration limits if needed.
