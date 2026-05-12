<?php get_header(); ?>

<main>
  <section class="hero">
    <div class="site-wrap hero-card">
      <div>
        <p style="margin-top:0; color:#fde68a; letter-spacing:0.05em; text-transform:uppercase; font-size:0.86rem;">Color. Precision. Craft.</p>
        <h1>Home painting, exterior restoration, and premium finish work for residential clients.</h1>
        <p>
          Serving your local area with dependable service, clean workdays, and transparent pricing.
          Whether it is one room refresh or a complete exterior refresh, we finish on time and with pride.
        </p>

        <ul class="hero-points">
          <li>Licensed and insured specialists</li>
          <li>Low-to-no odor paints and clean setup/cleanup</li>
          <li>Free in-home estimates and color consultation</li>
        </ul>

        <div class="hero-actions">
          <a class="btn btn-primary" href="#contact">Get a Free Quote</a>
          <a class="btn btn-secondary" href="#work">View Projects</a>
        </div>
      </div>

      <div class="hero-badge">
        <strong>Why local families choose us</strong>
        <p style="margin:0; color:#cbd5e1;">
          We prioritize communication, accurate estimates, and craftsmanship that stays beautiful year after year.
        </p>
      </div>
    </div>
  </section>

  <section class="section" id="services">
    <div class="site-wrap">
      <h2 class="section-title">Services</h2>
      <p class="section-subtitle">Every room matters. Every coat matters.</p>
      <div class="cards-grid">
        <?php
        $services = [
          ['title' => 'Interior Painting', 'desc' => 'Drywall prep, trim, ceilings, and full interior repainting with clean edge masking and crisp detail.'],
          ['title' => 'Exterior Painting', 'desc' => 'Power wash prep, caulk, primer, and weather-ready exterior systems tailored for long-lasting finish.'],
          ['title' => 'Cabinets and Trim', 'desc' => 'High-precision touchups and full cabinet refinishing for kitchens and bathrooms.'],
          ['title' => 'Decorative Finishes', 'desc' => 'Color consultation and specialty finishes to match your design goals.'],
          ['title' => 'Drywall Repair', 'desc' => 'Small and large patching, smoothing, and texturing before final paint coats.'],
          ['title' => 'Maintenance Plans', 'desc' => 'Annual refresh plans for stucco, siding, decks, and interior touchups.'],
        ];

        foreach ($services as $service) :
        ?>
          <article class="card">
            <h3><?php echo esc_html($service['title']); ?></h3>
            <p><?php echo esc_html($service['desc']); ?></p>
          </article>
        <?php endforeach; ?>
      </div>
    </div>
  </section>

  <section class="section" id="work">
    <div class="site-wrap">
      <h2 class="section-title">Recent Work</h2>
      <p class="section-subtitle">A sample of recent residential projects.</p>
      <div class="gallery">
        <figure class="tile">
          <img loading="lazy" src="https://images.unsplash.com/photo-1600607687644-4cb2d9ee5f7b?auto=format&fit=crop&w=1200&q=80" alt="Living room painted in warm neutral tones">
          <figcaption class="tile-caption">Modern living room repaint</figcaption>
        </figure>
        <figure class="tile">
          <img loading="lazy" src="https://images.unsplash.com/photo-1560185127-6e8f8f6f58ce?auto=format&fit=crop&w=1200&q=80" alt="Exterior house wall freshly painted">
          <figcaption class="tile-caption">Exterior trim and siding refresh</figcaption>
        </figure>
        <figure class="tile">
          <img loading="lazy" src="https://images.unsplash.com/photo-1558618666-dfd2cf6a4e6f?auto=format&fit=crop&w=1200&q=80" alt="Kitchen cabinets with matte color finish">
          <figcaption class="tile-caption">Cabinet and accent walls</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <section class="section" id="pricing">
    <div class="site-wrap">
      <h2 class="section-title">Simple Pricing</h2>
      <p class="section-subtitle">Base starting rates.</p>
      <ul class="list">
        <li>Interior room: <strong>$1.85+/sq.ft</strong></li>
        <li>Exterior wall: <strong>$2.45+/sq.ft</strong></li>
        <li>Cabinet refinishing: <strong>from $650/project</strong></li>
        <li>Premium finish add-ons and prep pricing on request.</li>
      </ul>
    </div>
  </section>

  <section class="section" id="contact">
    <div class="site-wrap">
      <h2 class="section-title">Ready for your estimate?</h2>
      <div class="contact-grid">
        <div>
          <p style="color:#dbeafe; margin-top:0;">
            Drop your details and we will call you with a free estimate window within one business day.
          </p>
          <form method="post" action="#">
            <label for="name">Name</label>
            <input id="name" type="text" name="name" required>

            <label for="email">Email</label>
            <input id="email" type="email" name="email" required>

            <label for="phone">Phone</label>
            <input id="phone" type="tel" name="phone" required>

            <label for="project">Project details</label>
            <textarea id="project" name="project" placeholder="2-bedroom refresh, patio trim, etc." required></textarea>

            <button class="btn btn-primary" type="submit">Send Request</button>
          </form>
        </div>

        <div class="card">
          <h3>Service Area</h3>
          <p class="section-subtitle">Serving all metro and surrounding ZIPs</p>
          <p>Monday to Saturday</p>
          <p>8:00 AM - 6:00 PM</p>
          <p>
            Emergency touchups available for storm or water-damage cleanup by appointment.
          </p>
        </div>
      </div>
    </div>
  </section>
</main>

<?php get_footer(); ?>

