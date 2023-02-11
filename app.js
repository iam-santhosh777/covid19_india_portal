const express = require("express");
const { open } = require("sqlite");

const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

let db = null;

// Initializing Database.
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`server is running at http://localhost:3000`);
    });
  } catch (err) {
    console.log(`DB Error is: ${err}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// API : User Login.

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userCheck = `
            SELECT * FROM 
                user 
            WHERE 
                username = '${username}';`;
  const dbUser = await db.get(userCheck);
  if (dbUser !== undefined) {
    const passwordValidation = await bcrypt.compare(password, dbUser.password);
    if (passwordValidation) {
      // get JWT Token.
      let jwtToken;
      const payload = {
        username: username,
      };
      jwtToken = jwt.sign(payload, "santhosh_kumar_secret_key");
      response.send({ jwtToken }); // Scenario 3: return JWT Token
      //   console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password"); // Scenario 2: If the user provides an incorrect password
    }
  } else {
    response.status(400);
    response.send("Invalid user"); // Scenario 1: If an unregistered user tries to login
  }
});

// Authentication with Token.

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.header("authorization");

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "santhosh_kumar_secret_key", async (err, payload) => {
      if (err) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next(); // Scenario 2: After successful verification of token proceed to next middleware or handler
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token"); // Scenario 1: If the token is not provided by the user or an invalid token
  }
}

// API 2: Returns a list of all states in the state table

app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `
        SELECT state_id AS stateId, state_name AS stateName,
            population    
        FROM 
            state;`;
  const getStatesList = await db.all(statesQuery);
  response.send(getStatesList);
});

// API 3: Returns a state based on the state ID

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `
        SELECT state_id AS stateId, state_name AS stateName, population FROM
            state
        WHERE 
            state_id = ${stateId};`;
  const getState = await db.get(selectStateQuery);
  response.send(getState);
});

// API 4: Create a district in the district table, district_id is auto-incremented
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES(
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    )`;
  await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

// API 5:  Returns a district based on the district ID

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictByIDQuery = `
        SELECT 
            district_id AS districtId, district_name AS districtName, state_id AS stateId, cases, cured, active, deaths 
        FROM 
            district 
        WHERE 
            district_id = ${districtId};`;
    const getDistrictByIDQueryResponse = await db.get(getDistrictByIDQuery);
    response.send(getDistrictByIDQueryResponse);
  }
);

// API 6: Deletes a district from the district table based on the district ID
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;
    const deleteDistrictQueryResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// API 7: Updates the details of a specific district based on the district ID

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE district SET 
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE 
            district_id = ${districtId};`;
    const updateDistrictQueryResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// API 8: Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateByIDStatsQuery = `select sum(cases) as totalCases, sum(cured) as totalCured,
    sum(active) as totalActive , sum(deaths) as totalDeaths from district where state_id = ${stateId};`;

    const getStateByIDStatsQueryResponse = await db.get(getStateByIDStatsQuery);
    response.send(getStateByIDStatsQueryResponse);
  }
);

module.exports = app;
