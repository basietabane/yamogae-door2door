const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let selectedTrip = null;
let currentSearch = {
  from: "",
  destination: "",
  date: "",
  passengers: 1
};


// ================================
// BASIC SCREEN CONTROL
// ================================

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  const screen = document.getElementById(id);

  if (screen) {
    screen.classList.add("active");
    window.scrollTo(0, 0);
  }

  if (id === "myBookings") {
    loadMyBookings();
  }

  if (id === "driver") {
    loadDriverDashboard();
  }

  if (id === "admin") {
    loadAdminTrips();
  }
}


// ================================
// INITIAL STARTUP
// ================================

document.addEventListener("DOMContentLoaded", async () => {
  await loadDepartureAreas();

  const today = new Date().toISOString().split("T")[0];

  const dateInput = document.getElementById("tripDate");

  if (dateInput) {
    dateInput.min = today;
  }

  const { data } = await supabase.auth.getSession();

  if (data && data.session) {
    currentUser = data.session.user;
    await loadProfile();
  }
});


// ================================
// DEPARTURE AREAS + DESTINATIONS
// ================================

async function loadDepartureAreas() {
  const select = document.getElementById("from");

  if (!select) {
    console.error("Departure area element #from was not found.");
    return;
  }

  const { data, error } = await supabase
    .from("departure_areas")
    .select("id,name")
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Could not load departure areas:", error);
    return;
  }

  select.innerHTML =
    '<option value="">Select departure area</option>';

  (data || []).forEach(area => {
    const option = document.createElement("option");

    option.value = area.id;
    option.textContent = area.name;

    select.appendChild(option);
  });

  select.addEventListener("change", loadDestinationsForDeparture);

  resetDestinationField();
}


function resetDestinationField() {
  const destination = document.getElementById("destination");

  if (!destination) {
    console.error("Destination element #destination was not found.");
    return;
  }

  destination.value = "";

  if (destination.tagName === "SELECT") {
    destination.innerHTML =
      '<option value="">Select destination</option>';
    destination.disabled = true;
  }

  if (destination.tagName === "INPUT") {
    destination.placeholder = "Select departure area first";

    const listId = destination.getAttribute("list");

    if (listId) {
      const list = document.getElementById(listId);
      if (list) list.innerHTML = "";
    }
  }
}


async function loadDestinationsForDeparture() {
  const from = document.getElementById("from");
  const destination = document.getElementById("destination");

  if (!from || !destination) return;

  const departureAreaId = from.value;

  if (!departureAreaId) {
    resetDestinationField();
    return;
  }

  destination.disabled = true;

  if (destination.tagName === "SELECT") {
    destination.innerHTML =
      '<option value="">Loading destinations...</option>';
  } else if (destination.tagName === "INPUT") {
    destination.value = "";
    destination.placeholder = "Loading destinations...";
  }

  const { data, error } = await supabase
    .from("routes")
    .select("id,destination")
    .eq("departure_area_id", departureAreaId)
    .eq("active", true)
    .order("destination");

  if (error) {
    console.error("Could not load destinations:", error);

    if (destination.tagName === "SELECT") {
      destination.innerHTML =
        '<option value="">Could not load destinations</option>';
    } else {
      destination.value = "";
      destination.placeholder = "Could not load destinations";
    }

    return;
  }

  const routes = data || [];

  if (!routes.length) {
    if (destination.tagName === "SELECT") {
      destination.innerHTML =
        '<option value="">No destinations available</option>';
    } else {
      destination.value = "";
      destination.placeholder = "No destinations available";
    }

    return;
  }

  // DESTINATION IS A SELECT
  if (destination.tagName === "SELECT") {
    destination.innerHTML =
      '<option value="">Select destination</option>';

    routes.forEach(route => {
      const option = document.createElement("option");

      option.value = route.destination;
      option.textContent = route.destination;

      option.dataset.routeId = route.id;

      destination.appendChild(option);
    });

    destination.disabled = false;
    return;
  }

  // DESTINATION IS AN INPUT
  if (destination.tagName === "INPUT") {
    let listId = destination.getAttribute("list");

    if (!listId) {
      listId = "destinationOptions";
      destination.setAttribute("list", listId);
    }

    let list = document.getElementById(listId);

    if (!list) {
      list = document.createElement("datalist");
      list.id = listId;
      destination.parentNode.appendChild(list);
    }

    list.innerHTML = "";

    routes.forEach(route => {
      const option = document.createElement("option");
      option.value = route.destination;
      list.appendChild(option);
    });

    destination.placeholder = "Select or enter destination";
    destination.disabled = false;
  }
}


// ================================
// AUTHENTICATION
// ================================

async function signUp() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();

  const message = document.getElementById("accountMessage");

  if (!email || !password || !fullName || !phone) {
    message.textContent = "Please complete all fields.";
    return;
  }

  message.textContent = "Creating your account...";

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  if (!data.user) {
    message.textContent = "Account created. Please check your email.";
    return;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: data.user.id,
      full_name: fullName,
      phone: phone,
      role: "passenger"
    });

  if (profileError) {
    console.error(profileError);
    message.textContent =
      "Account created, but profile setup needs attention.";
    return;
  }

  currentUser = data.user;

  message.textContent =
    "Account created successfully.";

  showScreen("home");
}


async function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const message = document.getElementById("accountMessage");

  if (!email || !password) {
    message.textContent = "Enter your email and password.";
    return;
  }

  message.textContent = "Signing in...";

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    message.textContent = error.message;
    return;
  }

  currentUser = data.user;

  await loadProfile();

  message.textContent = "Signed in successfully.";

  showScreen("home");
}


async function logout() {
  await supabase.auth.signOut();

  currentUser = null;

  showScreen("home");
}


// ================================
// PROFILE
// ================================

async function loadProfile() {
  if (!currentUser) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  if (!data) return null;

  if (data.role === "driver") {
    const welcome =
      document.getElementById("driverWelcome");

    if (welcome) {
      welcome.textContent =
        "Welcome, " + (data.full_name || "Driver");
    }
  }

  return data;
}


// ================================
// SEARCH TRIPS
// ================================

async function searchTrips() {
  const from = document.getElementById("from").value;

  const destination =
    document.getElementById("destination").value.trim();

  const date =
    document.getElementById("tripDate").value;

  const passengers =
    Number(document.getElementById("passengers").value || 1);

  if (!from) {
    alert("Please select where you are leaving from.");
    return;
  }

  if (!destination) {
    alert("Please select or enter your destination.");
    return;
  }

  if (!date) {
    alert("Please select your travel date.");
    return;
  }

  currentSearch = {
    from,
    destination,
    date,
    passengers
  };

  const summary =
    document.getElementById("tripSearchSummary");

  summary.textContent =
    `Searching for ${passengers} passenger(s) from your selected departure area to ${destination} on ${date}.`;

  showScreen("trips");

  const results =
    document.getElementById("tripResults");

  results.innerHTML =
    '<div class="card"><p>Searching available trips...</p></div>';

  const { data: routes, error: routeError } =
    await supabase
      .from("routes")
      .select("id,destination")
      .eq("departure_area_id", from)
      .eq("active", true);

  if (routeError) {
    console.error(routeError);

    results.innerHTML =
      '<div class="card"><p>Could not load routes.</p></div>';

    return;
  }

  const matchingRoutes = (routes || []).filter(route =>
    String(route.destination || "").toLowerCase() ===
    destination.toLowerCase()
  );

  if (!matchingRoutes.length) {
    results.innerHTML = `
      <div class="card">
        <h3>No trip found</h3>
        <p>
          There is currently no route matching
          <strong>${escapeHtml(destination)}</strong>.
        </p>
        <p>
          An admin can add this destination when the route becomes available.
        </p>
      </div>
    `;

    return;
  }

  const routeIds = matchingRoutes.map(route => route.id);

  const { data: trips, error: tripError } =
    await supabase
      .from("trips")
      .select(`
        *,
        routes (
          destination
        ),
        vehicles (
          make_model,
          vehicle_type,
          passenger_capacity,
          registration
        )
      `)
      .in("route_id", routeIds)
      .eq("departure_date", date)
      .in("status", [
        "open",
        "confirmed",
        "driver_assigned"
      ])
      .order("departure_time");

  if (tripError) {
    console.error(tripError);

    results.innerHTML =
      '<div class="card"><p>Could not load available trips.</p></div>';

    return;
  }

  if (!trips || !trips.length) {
    results.innerHTML = `
      <div class="card">
        <h3>No vehicles available yet</h3>
        <p>
          There are currently no confirmed vehicles for this route and date.
        </p>
      </div>
    `;

    return;
  }

  let html = "";

  for (const trip of trips) {
    const seats = await getAvailableSeats(trip);

    const vehicleCapacity =
      trip.vehicles?.passenger_capacity || 0;

    const vehicleName =
      trip.vehicles?.make_model || "Vehicle";

    const vehicleType =
      trip.vehicles?.vehicle_type === "7_seater"
        ? "7-seater"
        : "Sedan";

    const enoughSeats =
      seats >= passengers;

    html += `
      <div class="trip-card">

        <h3>
          ${escapeHtml(
            trip.routes?.destination ||
            destination
          )}
        </h3>

        <p>
          <strong>Departure:</strong>
          ${escapeHtml(trip.departure_time)}
        </p>

        <div class="trip-info">

          <div>
            <strong>Vehicle</strong>
            ${escapeHtml(vehicleName)}
          </div>

          <div>
            <strong>Type</strong>
            ${vehicleType}
          </div>

          <div>
            <strong>Seats</strong>
            <span class="seats ${
              enoughSeats ? "available" : "full"
            }">
              ${seats} available
            </span>
          </div>

          <div>
            <strong>Capacity</strong>
            ${vehicleCapacity} passengers
          </div>

        </div>

        <p class="price">
          R${Number(trip.price_per_passenger || 0).toFixed(0)}
          <span style="font-size:14px;font-weight:normal;">
            per passenger
          </span>
        </p>

        ${
          enoughSeats
            ? `
              <button onclick="selectTrip('${trip.id}')">
                Book this trip
              </button>
            `
            : `
              <button disabled>
                Not enough seats
              </button>
            `
        }

      </div>
    `;
  }

  results.innerHTML = html;
}


// ================================
// AVAILABLE SEATS
// ================================

async function getAvailableSeats(trip) {
  const capacity =
    Number(trip.vehicles?.passenger_capacity || 0);

  const { data, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("status", "booked");

  if (error) {
    console.error(error);
    return capacity;
  }

  const booked =
    data ? data.length : 0;

  return Math.max(0, capacity - booked);
}


// ================================
// SELECT TRIP
// ================================

async function selectTrip(tripId) {
  if (!currentUser) {
    alert("Please create an account or sign in before booking.");
    showScreen("account");
    return;
  }

  const { data: trip, error } =
    await supabase
      .from("trips")
      .select(`
        *,
        routes (
          destination
        ),
        vehicles (
          make_model,
          vehicle_type,
          passenger_capacity,
          registration
        )
      `)
      .eq("id", tripId)
      .maybeSingle();

  if (error || !trip) {
    alert("Unable to load this trip.");
    return;
  }

  selectedTrip = trip;

  const seats =
    await getAvailableSeats(trip);

  const selected =
    document.getElementById("selectedTrip");

  selected.innerHTML = `
    <div class="trip-card">

      <h3>
        ${escapeHtml(
          trip.routes?.destination || ""
        )}
      </h3>

      <p>
        <strong>Date:</strong>
        ${escapeHtml(trip.departure_date)}
      </p>

      <p>
        <strong>Departure:</strong>
        ${escapeHtml(trip.departure_time)}
      </p>

      <p>
        <strong>Vehicle:</strong>
        ${escapeHtml(
          trip.vehicles?.make_model || "Vehicle"
        )}
      </p>

      <p>
        <strong>Seats available:</strong>
        ${seats}
      </p>

      <p class="price">
        R${Number(
          trip.price_per_passenger || 0
        ).toFixed(0)}
        <span style="font-size:14px;font-weight:normal;">
          per passenger
        </span>
      </p>

    </div>
  `;

  const profile =
    await loadProfile();

  const phoneInput =
    document.getElementById("bookingPhone");

  if (profile?.phone) {
    phoneInput.value = profile.phone;
  }

  showScreen("booking");
}


// ================================
// CONFIRM BOOKING
// ================================

async function confirmBooking() {
  if (!currentUser) {
    alert("Please sign in first.");
    showScreen("account");
    return;
  }

  if (!selectedTrip) {
    alert("Please select a trip first.");
    return;
  }

  const pickupAddress =
    document
      .getElementById("pickupAddress")
      .value.trim();

  const phone =
    document
      .getElementById("bookingPhone")
      .value.trim();

  const message =
    document.getElementById("bookingMessage");

  if (!pickupAddress) {
    message.textContent =
      "Please enter your pickup address.";
    return;
  }

  if (!phone) {
    message.textContent =
      "Please enter your phone number.";
    return;
  }

  message.textContent =
    "Checking seat availability...";

  const seats =
    await getAvailableSeats(selectedTrip);

  const passengers =
    Number(currentSearch.passengers || 1);

  if (seats < passengers) {
    message.textContent =
      "Sorry, there are no longer enough seats available.";
    return;
  }

  const rows = [];

  for (let i = 0; i < passengers; i++) {
    rows.push({
      trip_id: selectedTrip.id,
      passenger_id: currentUser.id,
      pickup_address: pickupAddress,
      phone: phone,
      status: "booked"
    });
  }

  const { error } =
    await supabase
      .from("bookings")
      .insert(rows);

  if (error) {
    console.error(error);

    message.textContent =
      error.message;

    return;
  }

  message.textContent =
    "Booking confirmed successfully.";

  setTimeout(() => {
    showScreen("myBookings");
  }, 800);
}


// ================================
// MY BOOKINGS
// ================================

async function loadMyBookings() {
  const container =
    document.getElementById("bookingResults");

  if (!currentUser) {
    container.innerHTML =
      "<p>Please sign in to see your bookings.</p>";
    return;
  }

  container.innerHTML =
    "<p>Loading bookings...</p>";

  const { data, error } =
    await supabase
      .from("bookings")
      .select(`
        *,
        trips (
          departure_date,
          departure_time,
          price_per_passenger,
          status,
          routes (
            destination
          ),
          vehicles (
            make_model,
            registration
          )
        )
      `)
      .eq("passenger_id", currentUser.id)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);

    container.innerHTML =
      "<p>Could not load your bookings.</p>";

    return;
  }

  if (!data || !data.length) {
    container.innerHTML =
      "<p>You do not have any bookings yet.</p>";

    return;
  }

  let html = "";

  data.forEach(booking => {

    const trip = booking.trips;

    html += `
      <div class="booking-card">

        <h3>
          ${escapeHtml(
            trip?.routes?.destination || "Trip"
          )}
        </h3>

        <p>
          <strong>Date:</strong>
          ${escapeHtml(
            trip?.departure_date || ""
          )}
        </p>

        <p>
          <strong>Departure:</strong>
          ${escapeHtml(
            trip?.departure_time || ""
          )}
        </p>

        <p>
          <strong>Pickup:</strong>
          ${escapeHtml(
            booking.pickup_address || ""
          )}
        </p>

        <p>
          <strong>Vehicle:</strong>
          ${escapeHtml(
            trip?.vehicles?.make_model ||
            "Vehicle"
          )}
        </p>

        <p>
          <strong>Booking status:</strong>
          <span class="status">
            ${escapeHtml(
              booking.status
            )}
          </span>
        </p>

        ${
          booking.status === "booked"
            ? `
              <button
                class="secondary"
                onclick="cancelBooking('${booking.id}')"
              >
                Cancel booking
              </button>
            `
            : ""
        }

      </div>
    `;
  });

  container.innerHTML = html;
}


// ================================
// CANCEL BOOKING
// ================================

async function cancelBooking(bookingId) {
  const confirmed =
    confirm(
      "Are you sure you want to cancel this booking?"
    );

  if (!confirmed) return;

  const { error } =
    await supabase
      .from("bookings")
      .update({
        status: "cancelled"
      })
      .eq("id", bookingId)
      .eq("passenger_id", currentUser.id);

  if (error) {
    alert(error.message);
    return;
  }

  alert(
    "Booking cancelled. The seat is available again."
  );

  loadMyBookings();
}


// ================================
// DRIVER DASHBOARD
// ================================

async function loadDriverDashboard() {
  if (!currentUser) return;

  const container =
    document.getElementById("driverTrips");

  container.innerHTML =
    "<div class='card'><p>Loading assigned trips...</p></div>";

  const { data: vehicles, error: vehicleError } =
    await supabase
      .from("vehicles")
      .select("*")
      .eq("driver_id", currentUser.id);

  if (vehicleError) {
    console.error(vehicleError);

    container.innerHTML =
      "<div class='card'><p>Could not load vehicle.</p></div>";

    return;
  }

  if (!vehicles || !vehicles.length) {
    container.innerHTML =
      "<div class='card'><p>No vehicle has been assigned to you yet.</p></div>";

    return;
  }

  const vehicleIds =
    vehicles.map(vehicle => vehicle.id);

  const { data: trips, error: tripError } =
    await supabase
      .from("trips")
      .select(`
        *,
        routes (
          destination
        )
      `)
      .in("vehicle_id", vehicleIds)
      .order("departure_date")
      .order("departure_time");

  if (tripError) {
    console.error(tripError);

    container.innerHTML =
      "<div class='card'><p>Could not load trips.</p></div>";

    return;
  }

  if (!trips || !trips.length) {
    container.innerHTML =
      "<div class='card'><p>No trips assigned yet.</p></div>";

    return;
  }

  let html = "";

  for (const trip of trips) {

    const { data: bookings } =
      await supabase
        .from("bookings")
        .select("*")
        .eq("trip_id", trip.id)
        .eq("status", "booked");

    html += `
      <div class="driver-trip-card">

        <h3>
          ${escapeHtml(
            trip.routes?.destination || ""
          )}
        </h3>

        <p>
          <strong>Date:</strong>
          ${escapeHtml(trip.departure_date)}
        </p>

        <p>
          <strong>Departure:</strong>
          ${escapeHtml(trip.departure_time)}
        </p>

        <h4>Passengers</h4>

        ${
          bookings && bookings.length
            ? bookings.map((booking, index) => `
                <div class="card">
                  <strong>Passenger ${index + 1}</strong>
                  <p>
                    Pickup:
                    ${escapeHtml(
                      booking.pickup_address
                    )}
                  </p>
                  <p>
                    Phone:
                    ${escapeHtml(
                      booking.phone
                    )}
                  </p>
                </div>
              `).join("")
            : "<p>No passengers booked yet.</p>"
        }

      </div>
    `;
  }

  container.innerHTML = html;
}


// ================================
// ADMIN
// ================================

async function createTrip() {
  const destination =
    document
      .getElementById("adminDestination")
      .value.trim();

  const date =
    document
      .getElementById("adminDate")
      .value;

  const time =
    document
      .getElementById("adminTime")
      .value;

  const price =
    Number(
      document
        .getElementById("adminPrice")
        .value
    );

  const message =
    document.getElementById("adminMessage");

  if (!destination || !date || !time || !price) {
    message.textContent =
      "Please complete all trip fields.";
    return;
  }

  message.textContent =
    "Trip creation requires a route and vehicle.";
}


// ================================
// ADMIN TRIPS
// ================================

async function loadAdminTrips() {
  const container =
    document.getElementById("adminTrips");

  if (!container) return;

  container.innerHTML =
    "<p>Loading trips...</p>";

  const { data, error } =
    await supabase
      .from("trips")
      .select(`
        *,
        routes (
          destination
        ),
        vehicles (
          make_model,
          registration,
          passenger_capacity
        )
      `)
      .order("departure_date")
      .order("departure_time");

  if (error) {
    console.error(error);

    container.innerHTML =
      "<p>Could not load trips.</p>";

    return;
  }

  if (!data || !data.length) {
    container.innerHTML =
      "<p>No trips created yet.</p>";

    return;
  }

  let html = "";

  for (const trip of data) {

    const seats =
      await getAvailableSeats(trip);

    html += `
      <div class="booking-card">

        <h3>
          ${escapeHtml(
            trip.routes?.destination || "Trip"
          )}
        </h3>

        <p>
          ${escapeHtml(
            trip.departure_date
          )}
          at
          ${escapeHtml(
            trip.departure_time
          )}
        </p>

        <p>
          Vehicle:
          ${escapeHtml(
            trip.vehicles?.make_model ||
            "Not assigned"
          )}
        </p>

        <p>
          Available seats:
          <strong>${seats}</strong>
        </p>

        <p>
          Status:
          <span class="status">
            ${escapeHtml(trip.status)}
          </span>
        </p>

      </div>
    `;
  }

  container.innerHTML = html;
}


// ================================
// HTML SAFETY
// ================================

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
