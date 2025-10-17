// Arrays for multiple users
let usernames = ["admin", "student", "guest"];
let passwords = ["1234", "abcd", "guest"];

// Function: check login when button is clicked
function Login() {
  let user = document.getElementById("username").value;
  let pass = document.getElementById("password").value;

  for (let i = 0; i < usernames.length; i++) {
    if (user === usernames[i] && pass === passwords[i]) {
      window.location.href = "home.html"; // go to home
      return;
    }
  }

  // Show error if no match
  document.getElementById("message").innerText = "Login failed. Try again.";
}
