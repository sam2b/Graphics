/*
 * Author: Sam Brendel, 3/2019
 * TCSS458, Professor John Mayer
 * Included students' gears:
 *    Armoni Atherton
 *    Josh Atherton
 *    Brian Mathew
 *    Kelsey Oxford
 *    Daniel Tovar
 *    Sam Brendel
 * Music by Daft Punk: "Tron Legacy"
*/

const music = new Sound("audio/tron.mp3", false);
const cameraSpeed = 2500.0; // 3000 is a moderate initial speed.
var spin = 0.0;             // Changes with the infinite loop.
var animationMultiplier = 1.0;   // Adjustable by pressing the F and S keys.
var fadeIn = 0.0;

//main(); // Instead this is called by the button created in the html file.

/**
 * Specifies the quantity of decimal places to round to.
 * @param {*} value
 * @param {*} decimals
 */
function round(value, decimals) {
  return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

function main() {
  document.getElementById('start-game').hidden = true;
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl', {antialias: true}  );

  // If we don't have a GL context, give up now
  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  var angle_x = 0;
  var angle_y = 0;
  var gear_id = 0;

  // Vertex shader program, runs on GPU, once per vertex

const vsSource = `
  // Vertex Shader
  precision mediump int;
  precision mediump float;

  // Scene transformations
  uniform mat4 u_PVM_transform; // Projection, view, model transform
  uniform mat4 u_VM_transform;  // View, model transform

  // Light model
  uniform vec3 u_Light_position;
  uniform vec3 u_Light_color;
  uniform float u_Shininess;
  uniform vec3 u_Ambient_color;

  // Original model data
  attribute vec3 a_Vertex;
  attribute vec3 a_Color;
  attribute vec3 a_Vertex_normal;

  // Data (to be interpolated) that is passed on to the fragment shader
  varying vec3 v_Vertex;
  varying vec4 v_Color;
  varying vec3 v_Normal;

  void main() {

    // Perform the model and view transformations on the vertex and pass this
    // location to the fragment shader.
    v_Vertex = vec3( u_VM_transform * vec4(a_Vertex, 1.0) );

    // Perform the model and view transformations on the vertex's normal vector
    // and pass this normal vector to the fragment shader.
    v_Normal = vec3( u_VM_transform * vec4(a_Vertex_normal, 0.0) );

    // Pass the vertex's color to the fragment shader.
    v_Color = vec4(a_Color, 1.0);

    // Transform the location of the vertex for the rest of the graphics pipeline
    gl_Position = u_PVM_transform * vec4(a_Vertex, 1.0);
  }
`;

  // Fragment shader program, runs on GPU, once per potential pixel

const fsSource = `
  // Fragment shader program
  precision mediump int;
  precision mediump float;

  // Light model
  uniform vec3 u_Light_position;
  uniform vec3 u_Light_color;
  uniform float u_Shininess;
  uniform vec3 u_Ambient_color;
  uniform vec3 u_fadeIn_color;

  // Data coming from the vertex shader
  varying vec3 v_Vertex;
  varying vec4 v_Color;
  varying vec3 v_Normal;

  void main() {

    vec3 to_light;
    vec3 vertex_normal;
    vec3 reflection;
    vec3 to_camera;
    float cos_angle;
    vec3 diffuse_color;
    vec3 specular_color;
    vec3 ambient_color;
    vec3 color;

    // Calculate the ambient color as a percentage of the surface color
    ambient_color = u_Ambient_color * vec3(v_Color) * u_fadeIn_color;

    // Calculate a vector from the fragment location to the light source
    to_light = u_Light_position - v_Vertex;
    to_light = normalize( to_light );

    // The vertex's normal vector is being interpolated across the primitive
    // which can make it un-normalized. So normalize the vertex's normal vector.
    vertex_normal = normalize( v_Normal );

    // Calculate the cosine of the angle between the vertex's normal vector
    // and the vector going to the light.
    cos_angle = dot(vertex_normal, to_light);
    cos_angle = clamp(cos_angle, 0.0, 1.0);

    // Scale the color of this fragment based on its angle to the light.
    diffuse_color = vec3(v_Color) * cos_angle * u_fadeIn_color;

    // Calculate the reflection vector
    reflection = 2.0 * dot(vertex_normal,to_light) * vertex_normal - to_light;

    // Calculate a vector from the fragment location to the camera.
    // The camera is at the origin, so negating the vertex location gives the vector
    to_camera = -1.0 * v_Vertex;

    // Calculate the cosine of the angle between the reflection vector
    // and the vector going to the camera.
    reflection = normalize( reflection );
    to_camera = normalize( to_camera );
    cos_angle = dot(reflection, to_camera);
    cos_angle = clamp(cos_angle, 0.0, 1.0);
    cos_angle = pow(cos_angle, u_Shininess);

    // The specular color is from the light source, not the object
    if (cos_angle > 0.0) {
      specular_color = u_Light_color * cos_angle * u_fadeIn_color;
      diffuse_color = diffuse_color * (1.0 - cos_angle) * u_fadeIn_color;
    } else {
      specular_color = vec3(0.0, 0.0, 0.0);
    }

    color = ambient_color + diffuse_color + specular_color;

    gl_FragColor = vec4(color, v_Color.a);
  }
`;

  // Initialize a shader program; this is where all
  // the lighting for the objects, if any, is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Tell WebGL to use our program when drawing
  gl.useProgram(shaderProgram);

  // Collect all the info needed to use the shader program.
  // Look up locations of attributes and uniforms used by
  // our shader program
  const programInfo = {
    program: shaderProgram,
    locations: {
      a_vertex: gl.getAttribLocation(shaderProgram, 'a_Vertex'),
      a_color: gl.getAttribLocation(shaderProgram, 'a_Color'),
      a_normal: gl.getAttribLocation(shaderProgram, 'a_Vertex_normal'),
      u_Light_position: gl.getUniformLocation(shaderProgram, 'u_Light_position'),
      u_light_color: gl.getUniformLocation(shaderProgram, 'u_Light_color'),
      u_shininess: gl.getUniformLocation(shaderProgram, 'u_Shininess'),
      u_ambient_color: gl.getUniformLocation(shaderProgram, 'u_Ambient_color'),
      u_PVM_transform: gl.getUniformLocation(shaderProgram, 'u_PVM_transform'),
      u_VM_transform: gl.getUniformLocation(shaderProgram, 'u_VM_transform'),
      u_fadeIn_color: gl.getUniformLocation(shaderProgram, 'u_fadeIn_color')
    },
  }

  // add an event handler so we can interactively rotate the model
  document.addEventListener('keydown',
    function key_event(event) {
      switch(event.keyCode) {
        case 32: // space bar
        case 77: // m key
          if(music._isPaused) {
            music.play();
          } else {
            music.pause();
          }
          break;
        // case 37:   //left
        //     angle_y -= 3;
        //     break;
        // case 38:  //top
        //     angle_x -= 3;
        //     break;
        // case 39:  //right
        //     angle_y += 3;
        //     break;
        // case 40:  //bottom
        //     angle_x += 3;
        //     break;
          case 70: // f key
            animationMultiplier += 0.3;
            console.log("+++++ faster");
            break;
          case 83: // s key
            if (animationMultiplier > 0) animationMultiplier -= 0.3;
            console.log("----- slower");
            break;
        // case 13: //enter
        //   gear_id += 1;
        //   if (gear_id > 28)
        //     gear_id = 28;
        //   break;
        // case 32: // space bar
        //   gear_id -= 1;
        //   if (gear_id < 0)
        //       gear_id = 0;
        //   break;
        }
        //console.log("Gear ID = ",gear_id);
        //buffers = initBuffers(gl,programInfo,gear_id);
        //enableAttributes(gl,buffers,programInfo)
        //drawScene(gl, programInfo, buffers, angle_x, angle_y);
        return false;
    })

  // build the object(s) we'll be drawing, put the data in buffers
    var buffersCollection = {};
    buffersCollection.gear1 = initBuffers(gl,programInfo, brendelGear(20, 6, 0.3));
    buffersCollection.gear2 = initBuffers(gl,programInfo, brendelGear(10, 3, 0.3));
    buffersCollection.gear3 = initBuffers(gl,programInfo, createBMathewGear(20, 8, 70, 70, 85, 95, 5, 5, 5, 218 / 255, 165 / 255, 32 / 255));
    buffersCollection.gear4 = initBuffers(gl,programInfo, createOxfordGear(10, 10, 1, 7, 5, .25, 75,0,130));
    buffersCollection.gear5 = initBuffers(gl,programInfo, tovarGear(20, 4));
    buffersCollection.gear6 = initBuffers(gl,programInfo, joshAthertonGear(80, 20));
    buffersCollection.gear7 = initBuffers(gl,programInfo, ArmoniAthertonGear(20, 30));
    buffersCollection.gear8 = initBuffers(gl,programInfo, brendelGear(40, 4, 0.6));
    buffersCollection.gear9 = initBuffers(gl,programInfo, joshAthertonGear(80, 20));
    buffersCollection.gear10 = initBuffers(gl,programInfo, ArmoniAthertonGear(20, 30));

  // Relocated this within initBuffers()
  //enableAttributes(gl,buffersCollection,programInfo)

  // Draw the scene in a continuos loop.
  var t = 0;
  self.animate = function () {
    // Draw the scene
    t += (1*animationMultiplier);
    if (t > cameraSpeed) t = 0;

    spin += (1*animationMultiplier); // Indefinitely increment this variable, else the inner spokes will jump around when varied by f or s keys.

    // Special delay function to time with the music into.
    if (fadeIn < 1.0) fadeIn = Math.pow(1.15, t)/(t*900000000); else fadeIn = 1.0;

    drawScene(gl, programInfo, buffersCollection, t);
    requestAnimationFrame(self.animate);
  }

  animate();
  music.play();
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple two-dimensional square.
//
function initBuffers(gl,programInfo, gearData) {
  const vertices = gearData[0];
  const colors = gearData[1];
  const normals = gearData[2];

  // Create  buffers for the object's vertex positions
  const vertexBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

  // Now pass the list of vertices to the GPU to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.
  gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array(vertices),
                gl.STATIC_DRAW);

  // do likewise for colors
  const colorBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

  gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array(colors),
                gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

  gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array(normals),
                gl.STATIC_DRAW);

  return {
    // each vertex in buffer has 3 floats
    num_vertices: vertices.length / 3,
    vertex: vertexBuffer,
    color: colorBuffer,
    normal: normalBuffer
  };
}

function enableAttributes(gl,buffers,programInfo) {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;

  // Tell WebGL how to pull vertex positions from the vertex
  // buffer. These positions will be fed into the shader program's
  // "a_vertex" attribute.
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertex);
    gl.vertexAttribPointer(
        programInfo.locations.a_vertex,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.locations.a_vertex);

    // likewise connect the colors buffer to the "a_color" attribute
    // in the shader program
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(
        programInfo.locations.a_color,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.locations.a_color);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.vertexAttribPointer(
        programInfo.locations.a_normal,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.locations.a_normal);
}

//
// Draw the scene.
//
function drawScene(gl, programInfo, buffersCollection, t) {    // angle_x, angle_y
  gl.clearColor(1.0*fadeIn, 1.0*fadeIn, 1.0*fadeIn, 1.0*fadeIn);  // Clear to white, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //make transform to implement interactive rotation
  var matrix = new Learn_webgl_matrix();
  var lookat = matrix.create();
  var u_PVMtransform = matrix.create();
  var u_VMtransform = matrix.create();
  var scale = matrix.create();
  var translate = matrix.create();
  var rotateX = matrix.create();
  var rotateY = matrix.create();
  var rotateZ = matrix.create();
  var spinning = matrix.create();
  var proj = matrix.createFrustum(-1,1,-1,1,3,1000); //matrix.createOrthographic(-1, 1, -1, 1, 3, 7);
  //matrix.rotate(rotate_x_matrix, angle_x, 1, 0, 0);
  //matrix.rotate(rotate_y_matrix, angle_y, 0, 1, 0);
  var camera_location = [0,0,0];

  // CORE VALUES TO CHANGE CAMERA VANTANGE.
  const xAxis = -5;
  const zoom = 5; // 5.5
  const yAxis = 5;
  const start =  [45, -2.9, 0]; //[zoom*Math.cos(xAxis*Math.PI/180), yAxis, zoom*Math.sin(xAxis*Math.PI/180), 0];
  var control_points = [start
                      ,[0, -1, -5]
                      ,[-50, 0, -13]
                      ,[0, 7, -4]
                      ,[0, 8, 20]
                      ,start
                      ];
  var cp;
  //y = (1 − t)3, green: y= 3(1 − t)2 t, red: y= 3(1 − t) t2, and cyan: y = t3

    // 5 points.
    function weight(t) {
      return [
              // 5 points WORKS.
                  Math.pow((1-t),5), // Actually Math.pow(t, 0)*Math.pow((1-t),5)
              5*t*Math.pow((1-t),4), // Actually 5*Math.pow(t, 1)*Math.pow((1-t),4)
               10*Math.pow(t, 2)*Math.pow((1-t),3),
               10*Math.pow(t, 3)*Math.pow((1-t),2),
                5*Math.pow(t, 4)*(1-t),
                  Math.pow(t, 5)

        // 10 points INCORRECT
            //  Math.pow(t, 10),
            //  10.0*t*Math.pow((1-t), 9),
            //   45.0*Math.pow(t, 2)*Math.pow((1-t), 8),
            // 120.0*Math.pow(t, 3)*Math.pow((1-t), 7),
            //  210.0*Math.pow(t, 4)*Math.pow((1-t), 6),
            // 252.0*Math.pow(t, 5)*Math.pow((1-t), 5),
            //  210.0*Math.pow(t, 6)*Math.pow((1-t), 4),
            // 120.0*Math.pow(t, 7)*Math.pow((1-t), 3),
            //   45.0*Math.pow(t, 8)*Math.pow((1-t), 2),
            //  10.0*Math.pow(t, 9)*(1-t),
            //   Math.pow(t, 10)

      //  4 Points.
      //          Math.pow(1-t,3),
      //          3*Math.pow(1-t,2)*t,
      //          3*(1-t)*Math.pow(t,2),
      //          Math.pow(t,3)
      ];
   }

   weights = weight(t / cameraSpeed); //100  The parenthesis here DO matter, else odd behavior.

   for (cp = 0; cp < control_points.length; cp++) {
      camera_location[0] += weights[cp] * control_points[cp][0];
      camera_location[1] += weights[cp] * control_points[cp][1];
      camera_location[2] += weights[cp] * control_points[cp][2];
    }
  //y = (1 − t)3, green: y= 3(1 − t)2 t, red: y= 3(1 − t) t2, and cyan: y = t3

  matrix.lookAt(lookat,
                // 5*Math.cos( t*Math.PI/180),0,5*Math.sin( t*Math.PI/180), // stationary debugging.
                camera_location[0], camera_location[1], camera_location[2],
                0,0,0,
                0,1,0);

  // Gear 1 Brendel Copper
  drawGear(buffersCollection.gear1,
    {x:0.8,y:0.8,z:0.8},   // scale
    {x:-0.4,y:0,z:0},      // translate
    null,                  // rotate X
    null,                  // rotate Y
    null,                  // rotate Z
    true,                  // spin in reverse
    100);                  // spin speed

  // GEAR 2 Brendel Copper
  drawGear(buffersCollection.gear2,
    {x:0.4,y:0.4,z:0.4},   // scale
    {x:0.95,y:0,z:0},      // translate
    null,                  // rotate X
    null,                  // rotate Y
    null,                  // rotate Z
    false,                 // spin in reverse
    200);                  // spin speed

  // GEAR 3 Matthew Yellow
  drawGear(buffersCollection.gear3,
    {x:0.8,y:0.8,z:0.8},   // scale
    {x:1.4,y:0.05,z:-0.90},   // translate
    null,                  // rotate X
    {angle:90},            // rotate Y
    null,                  // rotate Z
    true,                  // spin in reverse
    100);                  // spin speed

  // GEAR 4 Oxford purple
  drawGear(buffersCollection.gear4,
    {x:0.35,y:0.35,z:0.35},    // scale
    {x:1,y:-0.013,z:-1.7}, // translate
    null,                   // rotate X
    null,                   // rotate Y
    null,                   // rotate Z
    true,                   // spin in reverse
    200);                   // spin speed

  // GEAR 5
  drawGear(buffersCollection.gear5,
    {x:0.8,y:0.8,z:0.8},      // scale
    {x:-0.55,y:0.87,z:-1.05}, // translate
    {angle:90},               // rotate X
    null,                     // rotate Y
    null,                     // rotate Z
    true,                     // spin in reverse
    100);                     // spin speed

  // GEAR 6 Bottom Silver AthertonJ
  drawGear(buffersCollection.gear6,
    {x:0.3,y:0.3,z:0.3},   // scale
    {x:-0.55,y:0.98,z:-1.05}, // translate
    {angle:90},            // rotate X
    null,                  // rotate Y
    null,                  // rotate Z
    true,                  // spin in reverse
    100);                  // spin speed

  // GEAR 7 Front Silver AthertonA
  drawGear(buffersCollection.gear7,
    {x:0.1,y:0.1,z:0.1},     // scale
    {x:-0.55,y:1.10,z:-0.7}, // translate
    null,                    // rotate X
    null,                    // rotate Y
    null,                    // rotate Z
    false,                   // spin in reverse
    400);                    // spin speed

  // Gear 8 Brendel Copper
  drawGear(buffersCollection.gear8,
    {x:1.6,y:1.6,z:1.6},   // scale
    {x:-3.13,y:0,z:0},     // translate
    null,                  // rotate X
    null,                  // rotate Y
    null,                  // rotate Z
    false,                 // spin in reverse
    50);                   // spin speed

  // GEAR 9 Top Silver AthertonJ
  drawGear(buffersCollection.gear9,
    {x:0.3,y:0.3,z:0.3},      // scale
    {x:-0.55,y:1.21,z:-1.05}, // translate
    {angle:90},               // rotate X
    null,                     // rotate Y
    null,                     // rotate Z
    false,                    // spin in reverse
    100);                     // spin speed

  // GEAR 10 Rear Silver AthertonA
  drawGear(buffersCollection.gear10,
    {x:0.1,y:0.1,z:0.1},     // scale
    {x:-0.55,y:1.10,z:-1.4}, // translate
    null,                    // rotate X
    null,                    // rotate Y
    null,                    // rotate Z
    true,                    // spin in reverse
    400);                    // spin speed

  // The Floor.
  drawGear(createFloor()
    ,null            // scale
    ,{x:0,y:-2.5,z:0}, // translate
    // null,         // rotate X
    // null,         // rotate Y
    // null,         // rotate Z
    // null,         // spin in reverse
    // null);        // spin speed
    );

  function createFloor() {
    const vertices = [];
    const colors = [];
    const normals = [];
    for (var r = -5; r < 5; r++) {
      for (var c = -5; c < 5; c++) {
           vertices.push( r,0,c,  r+1,0,c, r,0,c+1);
           colors.push( 0.5,0,0, 0,0.3,0, 0,0,0.5);
           normals.push(0,1,0, 0,1,0, 0,1,0);
      }
    }
    return initBuffers(gl, programInfo, [vertices, colors, normals]);
  }

  // All objects drawn share this same code.
  function drawGear(buffers, sca, trans, rotX, rotY, rotZ, reverse, spinSpeed) {
    spinSpeed /= 100.0;
    enableAttributes(gl,buffers,programInfo);

    if (sca) {
      matrix.scale(scale, sca.x, sca.y, sca.z);
    } else {
      matrix.setIdentity(scale);
    }

    spinning = matrix.create();
    if (spinSpeed) {
      var direction = 1;
      if (reverse == true) direction = -1;
      matrix.rotate(spinning, (spin*spinSpeed), 0, 0, direction);  //
    } else {
      matrix.setIdentity(spinning);
    }

    translate = matrix.create();
    if (trans) {
      matrix.translate(translate, trans.x, trans.y, trans.z);
    } else {
      matrix.setIdentity(translate);
    }

    rotateX = matrix.create();
    if (rotX) {
    matrix.rotate(rotateX, rotX.angle, 1, 0, 0);
    } else {
      matrix.setIdentity(rotateX);
    }

    rotateY = matrix.create();
    if (rotY) {
    matrix.rotate(rotateY, rotY.angle, 0, 1, 0);
    } else {
      matrix.setIdentity(rotateY);
    }

    rotateZ = matrix.create();
    if (rotZ) {
      matrix.rotate(rotateZ, rotZ.angle, 0, 0, 1);
    } else {
      matrix.setIdentity(rotateZ);
      //console.debug("set identity z")
    }

    // Combine the two rotations into a single transformation
    matrix.multiplySeries(u_PVMtransform, proj, lookat, translate, rotateX, rotateY, rotateZ, spinning, scale); // rotate_x_matrix, rotate_y_matrix,
    matrix.multiplySeries(u_VMtransform, lookat, translate, rotateX, rotateY, rotateZ, spinning, scale); // Same but excluding the proj matrix. // rotate_x_matrix, rotate_y_matrix,

    // Set the shader program's uniform
    gl.uniformMatrix4fv(programInfo.locations.u_VM_transform, false, u_VMtransform);
    gl.uniformMatrix4fv(programInfo.locations.u_PVM_transform, false, u_PVMtransform);

    gl.uniform3f(programInfo.locations.u_Light_position, 3, 3, 0);

    gl.uniform3f(programInfo.locations.u_light_color, 1.0*fadeIn, 1.0*fadeIn, 1.0*fadeIn);
    gl.uniform1f(programInfo.locations.u_shininess, 50*fadeIn); //85
    gl.uniform3f(programInfo.locations.u_ambient_color, 0.5*fadeIn, 0.5*fadeIn, 0.5*fadeIn); //0.2, 0.2, 0.2
    gl.uniform3f(programInfo.locations.u_fadeIn_color, 1.0*fadeIn, 1.0*fadeIn, 1.0*fadeIn);

    { // now tell the shader (GPU program) to draw some triangles
      const offset = 0;
      gl.drawArrays(gl.TRIANGLES, offset, buffers.num_vertices);
    }
  }

}


//
// Initialize a shader program, so WebGL knows how to draw our data
// BOILERPLATE CODE, COPY AND PASTE
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }
  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.  BOILERPLATE CODE, COPY AND PASTE
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/*
//  build the object, including geometry (triangle vertices)
//  and possibly colors and normals for each vertex
function createGear() {
    const vertices = [];
    const colors = [];
    var i;
    var x = -0.5, y = 0, z = 0;
    var r = 0.1, g = 0.5, b = 0.9;

    for (i = 0; i < 10; i++) {

         vertices.push(x,y,z)
         vertices.push(x+0.2,y,z)
         vertices.push(x+0.1,y+0.3,z)

         colors.push(r,g,b);
         colors.push(r,g,b);
         colors.push(r,g,b);

         r += 0.2
         g += 0.2
         b += 0.2
         if (r > 1)
             r -= 1
         if (g > 1)
             g -= 1
         if (b > 1)
             b -= 1

         x += 0.1
         z += -0.05
    }
    return [vertices,colors]
}
*/
